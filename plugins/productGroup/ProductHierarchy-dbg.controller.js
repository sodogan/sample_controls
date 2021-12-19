/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise */
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
		"retail/pmr/promotionaloffers/utils/Models",
		"retail/pmr/promotionaloffers/plugins/productGroup/ProductsCategoryHelper",
		"retail/pmr/promotionaloffers/plugins/productGroup/DefineFilterHelper",
		"retail/pmr/promotionaloffers/utils/Constants"
	], function(Controller,JSONModel,Utils, TreeValueHelpDialog, Models,ProductsCategoryHelper,DefineFilterHelper,Constants) {
	"use strict";
	
	function InMemoryFilterHelper(filters){
		this.filters = filters;
	}
	
	InMemoryFilterHelper.prototype.getFilters = function(){
		return jQuery.extend(true, [], this.filters);
	};
	
	InMemoryFilterHelper.prototype.deleteFilter = function(id){
		this.filters = this.filters.filter(function(item){
			return item.NodeId !== id;
		});
	};
	
	InMemoryFilterHelper.prototype.setFilters = jQuery.noop;
	
	
	var productHierarchy = Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.ProductHierarchy", {
		constructor : function(){
   			Controller.apply(this, arguments);
   			this.dataProvider = null;
   			this.oModel = new JSONModel();
   			this.contentModel = new JSONModel();
   			this.resetView();   			
   		},
   		resetView : function(){
   			this.filterModified = {};
   			this.filtersWithData = {};
   			this.idOfNodeIfFilterIconClick = null;
   		},
   		getSmartTable: function(){
   			return this.getView().byId("leadingCategorySmartTable");
   		},
   		getTable: function(){
   			return this.getView().byId("productHierarchyTable");
   		},
   		setTableState: function(busy){
   			this.getTable().setBusy(busy);
   		},	
   		onInit: function() {
   			this.eventBus = sap.ui.getCore().getEventBus();
   			this.getView().setModel(this.oModel);
   			this.i18nBundle = Utils.getResourceModel();			
   			this.getView().setModel(this.i18nBundle, "i18n");
   			this.getView().setModel(this.contentModel, "Content");
   			
   			this.state = this.getOwnerComponent().getState();
   			
   			this.contentModel.setProperty("/ExcludedEnabled",false);
   			this.contentModel.setProperty("/DeleteEnabled",false);
   			this.contentModel.setProperty("/DefineFilter",false);
   			this.contentModel.setProperty("/RemoveFilters",false);
   			
   			this.smartTable = this.getSmartTable();
   			this.table = this.getTable();
   			this.table.setMinAutoRowCount(1);
   			this.table.setVisibleRowCount(1);
   			var self = this;
   			var removeOverlayer = function() {
   				self.table.setShowOverlay(false);
   			};	
   			this.table.addEventDelegate({ 
   				onAfterRendering : removeOverlayer 
   			});  
   			
   			
   			this.smartTable.setHeader(this.i18nBundle.getResourceBundle().getText("productHierarchy.Title"));
   			
   			this.masterDataSystem = this.state.offerData.MasterdataSystem; 
   			this.productCategoryHelper = new ProductsCategoryHelper(this.masterDataSystem,[],[]);
   			
   			this.oAddLeadingCategoryButton = this.getView().byId("addLeadingCategoryButton");
   			this.propertyLabels = null;
   			this.getMetadataEntityInformation();
   			
   			this.includePGSearch = this.getView().byId("includeProductGroupSearchId");
   		},
   		   		
   		getMetadataEntityInformation: function(){
   			var that = this;
   			var prom = Models.getMetadataAnalyzer();
   			prom.then(function(result){
   				var productFilterEntity = result.getSchemaDefinition().entityType.filter(function(item){
   					return item.name === "ProductFilter";
   				}); 
   				
   				if(productFilterEntity && productFilterEntity.length > 0){
   					that.propertyLabels = jQuery.extend([],productFilterEntity[0].property.map(function(prop){
   	   					return {Key: prop["name"], Label : prop["sap:label"]};
   	   				}));
   					
   					that.intervals = jQuery.extend([],productFilterEntity[0].property.filter(function(iter){
   						return iter["sap:filter-restriction"] === "interval";
   					}).map(function(prop){
   	   					return {Key: prop["name"]};
   	   				}));
   				}   				
   			});
   		},
   		clearTableSelections: function(){
   			this.breakNormalSelectionFlow = true;
   			this.table.clearSelection();
   			this.breakNormalSelectionFlow = false;
   		},
   		editSetIncludeRule: function(rulesArry){
   			var toSet = rulesArry.filter(function(item){
   				return item.Sign === "I";
   			});
   			
   			var replaceExisting = true;
   			this.productCategoryHelper.setIncludes(toSet,replaceExisting);
   		},
   		calculateFiltersModified: function(hierarchy){
   			var that = this;
   			
   			var findInHierarchy = function(id,items){
				for(var i = 0, iLen = items.length; i < iLen; i++){
					if(id === items[i].Id){
						return items[i];
					}						
					else if(items[i].children && items[i].children.length > 0){
						var result = findInHierarchy(id,items[i].children);
						if(result){
							return result;
						}
					}	
				}
				return null;
			};
			
			var removeVariablePartsFromFilter = function(serverFilter){
				var oServerFilter = jQuery.extend([],typeof serverFilter === "string" ? JSON.parse(serverFilter) : serverFilter);
				var arry = [];
				oServerFilter.forEach(function(item){
					arry.push({
						Property: item.Property,
						Option: item.Option,
						Sign: item.Sign,
						Low: item.Low,
						High: item.High,
						Text: item.Text
					});					
				});
				
				return JSON.stringify(arry);
			};
			
			var parentFilterEqualChildFilter = function(parentF, childF){
				return parentF === childF;
			};
			
			var calculateFiltersModified = function(){
				//root node does not have filters modified
				//if node has different filters then parent mark as filters modified
				
				var allFilters = that.filtersWithData;
				var copyHierarchy = jQuery.extend([],hierarchy);
				
				if(allFilters && Object.keys(allFilters).length > 0){
					for(var id in allFilters){
						var parentNode = findInHierarchy(allFilters[id].ParentId,copyHierarchy);
						var parentEqualChildFilter = null;
						var childFilter = removeVariablePartsFromFilter(allFilters[id].filters);
						if(parentNode){
							parentNode.Filters = removeVariablePartsFromFilter(parentNode.Filters);
							parentEqualChildFilter = parentFilterEqualChildFilter(parentNode.Filters,childFilter);
						}
						var notEmptyArray = allFilters[id].filters.length > 0;
						if(!parentEqualChildFilter && notEmptyArray){
							that.filterModified[id] = allFilters[id];
						}
						
						if(parentEqualChildFilter && notEmptyArray && !!that.filterModified[id]){
							delete that.filterModified[id];
						}
					}
				}
			};
			
			calculateFiltersModified();
   		},
   		setFiltersWithData: function(filters,nodes){
   			var that = this;
   			this.filtersWithData = {};
   			filters.forEach(function(filter){
   				if(!that.filtersWithData[filter.NodeId]){
   					nodes.forEach(function(node){
   						if(filter.NodeId === node.Id){
   							var filtersArry = [];
   							filtersArry.push(filter);
   							that.filtersWithData[filter.NodeId] = {ParentId: node.ParentId, filters:filtersArry};
   						}
   					});
   				}else{
   					that.filtersWithData[filter.NodeId].filters.push(filter);
   				}
   			});
   		},
   		setProductGroupData : function(data) {
   			if(!data.Display) {
   				this.oAddLeadingCategoryButton.setBusy(true);
   				Models.getLeadingCategoriesSet(this.masterDataSystem).then(function(aLeadingCategories){
   	   				this.contentModel.setProperty("/ProductsCategories", aLeadingCategories);
   	   				this.oAddLeadingCategoryButton.setBusy(false);
   	   			}.bind(this));
   			}
   			this.contentModel.setProperty("/EnableDelete", false);
   			this.contentModel.setProperty("/ReadOnly", !!data.Display);
			var rules = data.Rules ? data.Rules.results : [];
			
			this.editSetIncludeRule(rules);
			var replaceExisting = true;
			this.productCategoryHelper.setProductsCategory(data,replaceExisting);
			
			var isPreview = false;
			var isInclude = true;
			
			var hierarchy = this.productCategoryHelper.getHierarchy(isPreview,isInclude);
			
			//set filtersWithData
			if(data.Filters && data.Nodes){
				this.setFiltersWithData(data.Filters.results,data.Nodes.results);
			}
			
			this.filterHelper = new InMemoryFilterHelper(Utils.get(data, ["Filters", "results"]) || []);
			
			//end set calculation
			
			
			//calculate filter modified			
			this.calculateFiltersModified(hierarchy);
			//end calculation
			
			this.productCategoryHelper.markFilterModified(hierarchy,this.filterModified);
			
			this.oModel.setProperty("/ProductHierarchy",hierarchy);	
			this.clearTableSelections();
			this.resetLinkAndSelection();
			//fix to show 1 row in table
			var range = hierarchy.length === 0 ? 1 : 10;
			this.table.setVisibleRowCount(range);
			this.table.rerender();
		},
		getProductGroupData: function() {
			var payload = this.productCategoryHelper.getPayload();
			return payload;
		},
		getPGFilters: function(){
			if(!this.filterHelper){
				return [];
			}
			
			if(this.filterHelper){
				var allFilters = this.filterHelper.getFilters();
				for(var filter in this.filtersWithData){
					this.filtersWithData[filter].filters.forEach(function(iter){
						var found = allFilters.some(function(existing){
							return (existing.NodeId === iter.NodeId && existing.Property === iter.Property);	
						});
						
						if(!found){
							allFilters.push(iter);
						}
					});
				}

				return allFilters;
			}
		},
   		resetLinkAndSelection: function(){
   			this.contentModel.setProperty("/ExcludedEnabled",false);
			this.contentModel.setProperty("/DeleteEnabled",false);
			this.contentModel.setProperty("/SelectedProducts",[]);
   			this.contentModel.setProperty("/DefineFilter",false);
   			this.contentModel.setProperty("/RemoveFilters",false);
   		},
   		selectionChanged: function(oEvent){
   			var that = this;
   			if(this.breakNormalSelectionFlow){
   				return;
   			}
   			
   			var setBtnVisibility = function(products){
   				
   				if(products && products.length >= 2){
   					this.contentModel.setProperty("/DefineFilter",false);
   	   				this.contentModel.setProperty("/RemoveFilters",false);
   	   				this.contentModel.setProperty("/ExcludedEnabled",true);   	   				
   				}else if(products.length > 0){
   	   				this.contentModel.setProperty("/ExcludedEnabled",true);
   	   				this.contentModel.setProperty("/DefineFilter",products.length === 1 ? true : false );
   	   				var node = that.getNode(products[0].Id);
   	   				var filters = JSON.parse(node.Filters);
   	   				this.contentModel.setProperty("/RemoveFilters",(products.length === 1 && filters && filters.length > 0) ? true : false );
   	   				
   	   				var childFound = false;
   	   				for(var z = 0, zLen = products.length; z < zLen; z++){
   	   					if(!Utils.isInitial(products[z].VirtualParentId)){
   	   						childFound = true;
   	   						break;
   	   					}
   	   				}
   	   				
   	   				if(!childFound){
   	   					this.contentModel.setProperty("/DeleteEnabled",true);
   	   				}else{
   	   					this.contentModel.setProperty("/DeleteEnabled",false);
   	   				}
   	   			}else{
   	   				this.contentModel.setProperty("/ExcludedEnabled",false);
   	   				this.contentModel.setProperty("/DeleteEnabled",false);
   	   				this.contentModel.setProperty("/DefineFilter",false);
   	   				this.contentModel.setProperty("/RemoveFilters",false);
   	   			}
   			};
   			
   			var selectedItems = [];
   			if(oEvent.getParameter("selectAll")){
   				//select all
   				var indices = oEvent.getParameter("rowIndices");
   				var paths = [];
   				indices.forEach(function(index){
   					paths.push(oEvent.getSource().getContextByIndex(index).sPath);
   				});
   				
   				paths.forEach(function(path){
   					var item = oEvent.getParameter("rowContext").oModel.getProperty(path);
   					selectedItems.push({Id: item.Id, Dimension: item.Dimension, VirtualParentId: item.virtualParentId});
   				});
   				
   				this.contentModel.setProperty("/SelectedProducts",selectedItems);
   				setBtnVisibility.call(this,selectedItems);
   			}else if(oEvent.getParameter("rowIndex") === -1){
   	   			//deselect all
   				this.resetLinkAndSelection();
   			}else if(oEvent.getParameter("rowContext") && oEvent.getParameter("rowIndices").length === 1){
   				var sPath = oEvent.getParameter("rowContext").sPath;
   	   			var selectedItem = oEvent.getParameter("rowContext").oModel.getProperty(sPath);
   	   			var selectedProducts = this.contentModel.getProperty("/SelectedProducts") || [];
   	   			
   	   			var managerSelectedProducts = function(selectedItem){
   	   				var found = false;
   	   				for(var i = 0, iLen = selectedProducts.length; i < iLen; i++){
   	   					if(selectedProducts[i].Id === selectedItem.Id){
   	   						selectedProducts.splice(i, 1);
   	   						found = true;
   	   						break;
   	   					}   					
   	   				}
   	   				
   	   				if(!found){
   	   					selectedProducts.push({Id: selectedItem.Id, Dimension: selectedItem.Dimension, VirtualParentId: selectedItem.virtualParentId});
   	   				}
   	   			};
   	   			
   	   			managerSelectedProducts(selectedItem);
   	   			this.contentModel.setProperty("/SelectedProducts",selectedProducts);
   	   			setBtnVisibility.call(this,selectedProducts);
   			}		
   		},
   		handleExcludeProduct: function(oEvent){
   			var excluded = this.contentModel.getProperty("/SelectedProducts") || [];
   			
   			var hierarchy = this.table.getModel().getData().ProductHierarchy;
   			var includedNodes = [];
   			for(var i = 0, iLen = hierarchy.length; i < iLen; i++){
   				includedNodes.push({Id:hierarchy[i].Id});
   			}
   			
   			this.productCategoryHelper.setIncludes(includedNodes);
   			
   			this.eventBus.publish("retail.pmr.promotionaloffers", "excludedProducts", {excludedProducts:excluded});
   			this.resetLinkAndSelection();
			
			this.clearTableSelections();
   			this.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
   		},
   		removeAllFiltersFromHierarchy: function(hierarchy){
   			var that = this;

   			var removeDeep = function(items){
   				for(var i = 0, iLen = items.length; i < iLen; i++){
   					delete that.filterModified[items[i].Id];
   		   			delete that.filtersWithData[items[i].Id];
   		   			if (that.filterHelper) {
   		   				that.filterHelper.deleteFilter(items[i].Id);
   		   			}	
   		   			if(items[i].children && items[i].children.length > 0){
   		   				removeDeep(items[i].children);
   		   			}
   				}
   			};
   			removeDeep(hierarchy);
   		},
   		removeAllFiltersNotModifiedFromHierarchy: function(hierarchy){
   			var that = this;

   			var removeDeep = function(items){
   				for(var i = 0, iLen = items.length; i < iLen; i++){
   					if(!items[i].filterModified){
   						delete that.filterModified[items[i].Id];
   	   		   			delete that.filtersWithData[items[i].Id];
   	   		   			that.filterHelper.deleteFilter(items[i].Id);
   					}
   					
   		   			if(items[i].children && items[i].children.length > 0){
   		   				removeDeep(items[i].children);
   		   			}
   				}
   			};
   			delete hierarchy[0].filterModified;
   			removeDeep(hierarchy);
   		},
   		handleDeleteProduct: function(oEvent){
   			var sPath = oEvent.getSource().getBindingContext().getPath();
   			var selectedItem = this.oModel.getProperty(sPath);
   			var hierarchy = this.oModel.getProperty("/ProductHierarchy") || [];
   	   		
   			if(!selectedItem.isIncluded){
   				var dialogOptions = { type: sap.m.DialogType.Message, 
   						title: this.i18nBundle.getResourceBundle().getText("Product.Group.Delete.Hierarchy.Title"), 
   						message:this.i18nBundle.getResourceBundle().getText("Product.Group.Delete.Hierarchy.Message"),
   						btnOk: this.i18nBundle.getResourceBundle().getText("Product.Groups.Dialog.Search.For.Filters.Ok"), 
   						btnCancel: this.i18nBundle.getResourceBundle().getText("Product.Groups.Dialog.Search.For.Filters.Cancel"),
   						onCancel: function(){},
   						onOk: function(){},
   						view: this.getView(), 
   						state: sap.ui.core.ValueState.Warning
				};
   				
   				Utils.createDialogUtil(dialogOptions);
   				
   				this.clearTableSelections();
	   			this.resetLinkAndSelection();
   			}else{
   				for(var z = hierarchy.length - 1, zLen = 0; z >= zLen; z--){   	   			
   	   				if(selectedItem.Id === hierarchy[z].Id){
   	   					hierarchy.splice(z,1);
   	   					this.removeAllFiltersFromHierarchy([selectedItem]);
   	   					break;
   	   				}
   	   	   		}
   	   	   		
   	   	   		this.productCategoryHelper.removeIncludeNode(selectedItem.Id);
   				this.clearTableSelections();
   				this.resetLinkAndSelection();
   				
   	   	   		this.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
   			}
   		},
   		handleAddProductHierarchy: function(oEvent){
   			var that = this;
   			TreeValueHelpDialog.openDialog({
   				tableFragment: "retail.pmr.promotionaloffers.plugins.general.LeadingCategoryComplexSearch",
				title : "{i18n>productHierarchy.Title}",
				filterProps : ["ExtId","Name","HierarchyDescription","ExtHierarchyId"],
				values : Utils.buildHierarchy(this.contentModel.getProperty("/ProductsCategories"),"LeadingCategory"),
				multiselect : true ,
				styleClass: "sapUiSizeCompact",
				selectionChange : jQuery.noop,
				ok: function(e){
					var table = e.getSource().getTable();
					var selection = table.getSelectedIndices().map(function(i){
						return table.getContextByIndex(i).getObject();
					});
					that.productCategoryHelper.setIncludes(selection);
					that.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
					e.getSource().close();
				}
			});
   		}, 
   		setSearch: function(searchValue){
   			var bindings = this.smartTable.getTable().getBinding("rows");
   			var searchValue = searchValue || "";
   			var filterProps = ["Name","ExtId","TypeName","MerchandiseCategory","Size","Color","Brand","BaseUom"];
   			var tableFilter = Utils.uiFilter(filterProps);
   			
   			bindings.filter([tableFilter(searchValue)]);
   		},
   		onLiveChange: function(oEvent){
   			this.setSearch(oEvent.getParameter("newValue"));
   		},
   		getDataInclude: function(){
   			var hierarchy = this.oModel.getProperty("/ProductHierarchy");
   			
   			return this.productCategoryHelper.slimData(hierarchy,true);
   		},
   		resetIncludes: function(){
   			this.oModel.setProperty("/ProductHierarchy",[]);
   			this.productCategoryHelper = new ProductsCategoryHelper(this.masterDataSystem,[],[]);
   			this.setSearch("");
   			this.includePGSearch.setValue("");
   			this.resetView();
   		},
   		filterPress: function(oEvent){
   			var sPath = oEvent.getSource().getBindingContext().getPath();
   			var selectedItem = this.oModel.getProperty(sPath);
   			this.idOfNodeIfFilterIconClick = selectedItem;
   			
   			var oFilterPopover = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.fragments.FilterPopover", this);   			
   			this.getView().addDependent(oFilterPopover);
   			
   			oFilterPopover.bindElement(sPath);
   			oFilterPopover.setModel(this.i18nBundle, "i18n");
   			oFilterPopover.setModel(this.contentModel, "Content");
   			
   			var data = new JSONModel();
   			var filters = JSON.parse(selectedItem.Filters);
   			this.propertyLabels.forEach(function(label){
   				filters.forEach(function(iter){
   	   				if(iter.Property === label.Key){
   	   					iter.Label = label.Label;
   	   				}
   	   			});
   			});
   			
   			data.setProperty("/FilterItems",filters);
   			data.setProperty("/SelectedTitle", this.i18nBundle.getResourceBundle().getText("Product.Groups.Filter.For") + " " + selectedItem.Name);   			
   			oFilterPopover.setModel(data, "Data");
   			oFilterPopover.addCustomData(new sap.ui.core.CustomData({key:"to_popover_Id",value:selectedItem.Id}));
   			oFilterPopover.addCustomData(new sap.ui.core.CustomData({key:"to_popover_Name",value:selectedItem.Name}));
   			
			
   			var oButton = oEvent.getSource();
			jQuery.sap.delayedCall(0, this, function () {
				oFilterPopover.openBy(oButton);
			});
   		},
   		getNode: function(id){
   			var hierarchy = this.table.getModel().getData().ProductHierarchy;
   			var node = null;
   			
   			var findNode = function(items,id){
   				for(var i = 0, iLen = items.length; i < iLen; i++){
   					if(items[i].Id === id){
   						node = items[i];
   						break;   						
   					}else if(items[i].children && items[i].children.length > 0){
   						findNode(items[i].children,id);
   					}
   				}
   			};
   			
   			findNode(hierarchy,id);
   			
   			return node;
   		},
   		getFromCustomData: function(ctrl){
   			var toReturn = {};
   			
   			var cData = ctrl.getCustomData();
   			cData.forEach(function(cd){
				if(cd.getKey() === "to_popover_Id"){
					toReturn.to_popover_Id = cd.getValue();
				}else if(cd.getKey() === "to_popover_Name"){
					toReturn.to_popover_Name = cd.getValue();
				}else if(cd.getKey() === "from_popover"){
					toReturn.from_popover = cd.getValue();
				}
			});  
   			
   			return toReturn;
   		},
   		handleDefineFilter: function(oEvent){
   			var dialogTitle = "";
   			
   			var oDefineFilter = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.fragments.DefineFilter", this);
   			if(oEvent.getSource().getMetadata().getName() === "sap.m.Button"){
   				var popover = oEvent.getSource().getParent().getParent();
   				var data = this.getFromCustomData(popover);
   				oDefineFilter.addCustomData(new sap.ui.core.CustomData({key:"from_popover",value:data.to_popover_Id}));
   				dialogTitle = this.i18nBundle.getResourceBundle().getText("Product.Groups.Dialog.Title.Edit", data.to_popover_Name);
   			}else{
   				dialogTitle = this.i18nBundle.getResourceBundle().getText("Product.Groups.Dialog.Title", this.getNode(this.contentModel.getProperty("/SelectedProducts")[0].Id).Name);
   			}
   			
   			oDefineFilter.setTitle(dialogTitle);   			
   	   		oDefineFilter.setModel(this.i18nBundle, "i18n");
   	   			
   	   		var oDataModel = Models.getServiceModel();
   	   		oDefineFilter.setModel(oDataModel);
   			
   			
   			oDefineFilter.open();
   		},
   		checkFilterModified: function(oldFilter,newFilter, id){
   			if(!Utils.isInitial(oldFilter.ParentId)){
   				var identic = true;
   				
   				if(oldFilter.filters.length !== newFilter.filters.length){
   					identic = false;
   				}
   				else{
   					for(var i in oldFilter.filters){
   	   					for(var j in newFilter.filters){
   	   						if(oldFilter.filters[i].Property === newFilter.filters[j].Property){
   	   							identic = JSON.stringify(oldFilter.filters[i]) === JSON.stringify(newFilter.filters[j]) ? true : false;
   	   						}
   	   					}
   	   				}
   				}
   				
   				if(!identic){
   					this.filterModified[id] = newFilter;
   				}
   			}
   		},
   		onDefineFilterOkPress: function(oEvent){
   			var parent = oEvent.getSource().getParent(); 
   			parent.close();
   			
   			//check if filter was modified
   			var filtersObject = this.filterHelper.getFiltersObject();
   			var newFilters = jQuery.extend({},filtersObject.sfbFilters);
   			  			
   			this.filtersWithData = jQuery.extend(this.filtersWithData,newFilters,true);
   			this.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
   			
   			parent.destroy();
   		},
   		onDefineFilterCancelPress: function(oEvent){
   			this.idOfNodeIfFilterIconClick = null;
   			var parent = oEvent.getSource().getParent(); 
   			parent.close();
   			parent.destroy();
   		},
   		getFilter: function(id){
			var filters = "[]";
			var node = null;
			
			var hierarchys = this.oModel.getProperty("/ProductHierarchy") || [];
			
			var findDeep = function(items,id){
				for(var i = 0, iLen=items.length;i<iLen;i++){
					if(items[i].Id === id){
						filters = items[i].Filters;
						node = items[i];
						break;
					}else if(items[i].children && items[i].children.length > 0){
						findDeep(items[i].children,id);
					}
				}
			};
			
			if(hierarchys && hierarchys.length > 0){
				findDeep(hierarchys,id);
			}
			
			return {filters:filters, node:node};
   		},
   		onInitialise: function(oEvent){
   			var filterBar = oEvent.getSource();
   			var dialog = filterBar.getParent();
   			var dialogMode = Constants.DialogModeEnum.WithRadio;
   			var res = null;
   			
   			var dialogCustomData = oEvent.getSource().getParent().getCustomData();   			
   			if(dialogCustomData && dialogCustomData.length > 0 && dialogCustomData[0].getKey() === "from_popover"){
   				res = this.getFilter(dialogCustomData[0].getValue());
   			}else{
   				res = this.getFilter(this.contentModel.getProperty("/SelectedProducts")[0].Id);
   			}   			
   			
   			var filters = JSON.parse(res.filters);
   			if(filters && filters.length > 0){
   				this.filterHelper = new DefineFilterHelper(filterBar,dialog,dialogMode,filters,res.node,this.intervals);
   			}else{
   				this.filterHelper = new DefineFilterHelper(filterBar,dialog,dialogMode,[],null,this.intervals);
   			}
   		},
   		removeFilterDialog : function(selectedId){
   			var dialogModel = new JSONModel();
   			var that = this;
   			
			//dialog init
			var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.fragments.MultipleFilterDialog",{				
				onCancelPress : function() {
					dialog.close();
					dialog.destroy();						
				},
				onOkPress : function(oEvent) {					
					if(dialogModel.getData().AllUnmodifiedSubnodes){
						that.removeAllFiltersNotModifiedFromHierarchy([that.getNode(selectedId)]);
						that.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
					}
					if(dialogModel.getData().Subnodes){
						that.removeAllFiltersFromHierarchy([that.getNode(selectedId)]);
						that.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
					}
					if(dialogModel.getData().OnlyThisNode){
						delete that.filterModified[selectedId];
						delete that.filtersWithData[selectedId];
						that.filterHelper.deleteFilter(selectedId);
		   			
						that.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
					}
					this.onCancelPress();					
				}
			});
			dialog.setModel(Utils.getI18NModel(), "i18n");
			dialog.setModel(dialogModel, "Data");
			dialog.open();	
   		},
   		handleFilterRemove: function(oEvent){
   			var popover = oEvent.getSource().getParent().getParent();
   			var data = this.getFromCustomData(popover);
   			var selectedId = data.to_popover_Id;
   			this.removeFilterDialog(selectedId);
   		},
   		
   		handleRemoveFilter: function(){
   			var selectedNode = this.contentModel.getProperty("/SelectedProducts")[0];
   			var selectedId = selectedNode.Id;
   			this.removeFilterDialog(selectedId);		
   		},
   		assignFiltersChanged: function(oEvent){
   			var hierarchyId = null;
   			if(this.contentModel.getProperty("/SelectedProducts") && this.contentModel.getProperty("/SelectedProducts").length > 0){
   				hierarchyId = this.contentModel.getProperty("/SelectedProducts")[0].Id;
   			}else{
   				hierarchyId = this.getFromCustomData(oEvent.getSource().getParent()).from_popover;
   			}
   			var hierarchy = this.getNode(hierarchyId);
   			
   			//fix missing smart filter bar filters by manually checking input values
   			var manualFilters = {};
   			if(this.filterHelper && this.filterHelper.uiBuilderHelper){
   				var controlls = this.filterHelper.uiBuilderHelper.controlls;
   				controlls.forEach(function(item){
   					if(item.getAggregation("content") && item.getAggregation("content").length > 0){
   						var input = item.getAggregation("content")[0].getAggregation("content")[1];
   	   					var key = input.searchKey;
   	   					var value = input.getValue();
   	   					manualFilters[key] = { value:value };
   					}
   				});
   			}
   			
   			var sfbFilters = jQuery.extend({},oEvent.getSource().getFilterData());
   			for(var item in manualFilters){
				if(manualFilters[item].value){
					var token = this.filterHelper.generateFiltersManually(manualFilters[item].value,item);
					sfbFilters[item] = {items: [], ranges: [token]};
				}
			}
   			
   			//token manually deleted by user, remove from filtersWithData
   			if(this.filterHelper && Object.keys(sfbFilters).length === 0 && hierarchyId){
   				var radioOption = this.filterHelper.calculateRadioSelection();
   				if(radioOption === Constants.APPLY_CHANGES_RADIO.All_subnodes){
   					this.removeAllFiltersFromHierarchy([hierarchy]);
   				}else if(radioOption === Constants.APPLY_CHANGES_RADIO.Only_this_node){
   					delete this.filtersWithData[hierarchyId];
   					delete this.filterModified[hierarchyId];   
   					if(this.filterHelper){
   						this.filterHelper.deleteFilter(hierarchyId);
   					}
   				}else if(radioOption === Constants.APPLY_CHANGES_RADIO.All_unmodified_subnodes){
   					this.removeAllFiltersNotModifiedFromHierarchy([hierarchy]);
   				}   				
   			}
   			
   			if(this.filterHelper){
   				this.filterHelper.setFilters(sfbFilters,hierarchy,this.filterModified);
   			}   			
   		}
	});
	
	return productHierarchy;
});