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
		"retail/pmr/promotionaloffers/plugins/productGroup/ProductsCategoryHelper"
	], function(Controller,JSONModel,Utils, TreeValueHelpDialog, Models,ProductsCategoryHelper) {
	"use strict";
	
	var productExcludedHierarchy = Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.ProductHierarchyExcluded", {
		constructor : function(){
   			Controller.apply(this, arguments);
   			this.dataProvider = null;
   			this.oModel = new JSONModel();
   			this.contentModel = new JSONModel();
   		},
   		getSmartTable: function(){
   			return this.getView().byId("leadingCategoryExcludedSmartTable");
   		},
   		getTable: function(){
   			return this.getView().byId("productHierarchyExcludedTable");
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
   			
   			this.contentModel.setProperty("/IncludedEnabled",false);
   			
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
   			this.oAddLeadingCategoryButton = this.getView().byId("addLeadingCategoryButtonExcluded");
   			this.eventBus.subscribe("retail.pmr.promotionaloffers", "excludedProducts", this.handleExcludedProducts, this);
   			
   			this.excludePGFilter = this.getView().byId("excludeProductGroupSearchId");
   		},
   		   		
   		resetLinkAndSelection: function(){
   			this.contentModel.setProperty("/SelectedProducts",[]);
   			this.contentModel.setProperty("/IncludedEnabled",false);
   		},
   		clearTableSelections: function(){
   			this.breakNormalSelectionFlow = true;
   			this.table.clearSelection();
   			this.breakNormalSelectionFlow = false;
   		},
   		editSetExcludeRule: function(rulesArry){
   			var toSet = rulesArry.filter(function(item){
   				return item.Sign === "E";
   			});
   			
   			var replaceExisting = true;
   			this.productCategoryHelper.setExcludes(toSet,replaceExisting);
   		},
   		setProductGroupData : function(data) {	
   			if(!data.Display) {
   				this.oAddLeadingCategoryButton.setBusy(true);
   				Models.getLeadingCategoriesSet(this.masterDataSystem).then(function(aLeadingCategories){
   	   				this.contentModel.setProperty("/ProductsCategories", aLeadingCategories);
   	   				this.oAddLeadingCategoryButton.setBusy(false);
   	   			}.bind(this));
   			}
			this.productCategoryHelper.setProductsCategory(data);
			var hierarchy = this.productCategoryHelper.getExcludedProducts();
			var rules = data.Rules ? data.Rules.results : [];
			
			this.editSetExcludeRule(rules);
			this.contentModel.setProperty("/ReadOnly", !!data.Display);
			this.oModel.setProperty("/ProductHierarchy",hierarchy);	
			this.clearTableSelections();
			//fix to show 1 row in table
			var range = hierarchy.length === 0 ? 1 : 10;
			this.table.setVisibleRowCount(range);
			this.table.rerender();
		},
		
		getProductGroupData: function() {
			var payload = this.productCategoryHelper.getPayload();
			return payload;
		},
   		
   		onExit: function() {
   			this.eventBus.unsubscribe("retail.pmr.promotionaloffers", "excludedProducts", this.handleExcludedProducts, this);
		},
   		handleExcludedProducts: function(sChannelId, sEventId, oContext){
			var products = oContext.excludedProducts;
			var currentExcluded = this.productCategoryHelper.getExcludedProducts();
			var uniqueExcludes = jQuery.extend([],currentExcluded);
			
			for(var i = 0, iLen = products.length; i < iLen; i++){
				var found = false;
				for(var j = 0, jLen = currentExcluded.length; j < jLen; j++){
					if(products[i].Id === currentExcluded[j].Id || products[i].ParentId === currentExcluded[j].Id){
						found = true;
					}
				}
				
				if(!found){
					uniqueExcludes.push(products[i]);
				}
			}
			
			this.productCategoryHelper.setExcludes(uniqueExcludes);
   		},
   		selectionChanged: function(oEvent){
   			if(this.breakNormalSelectionFlow){
   				return;
   			}
   			
   			var setBtnVisibility = function(items){
   				if(items.length > 0){
   	   				this.contentModel.setProperty("/IncludedEnabled",true);
   	   			}else{
   	   				this.contentModel.setProperty("/IncludedEnabled",false);
   	   			}
   			};
   			
   			if(oEvent.getParameter("selectAll")){
   				//select all
   				var selectedItems = [];
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
   		handleIncludeProduct: function(oEvent){
   			var crtExcluded = this.productCategoryHelper.getExcludedProducts();
   			var selectedProducts = this.contentModel.getProperty("/SelectedProducts") || [];
   			
			for(var i = crtExcluded.length - 1, iLen = 0; i >= iLen; i--){
				for(var j = 0, jLen = selectedProducts.length; j < jLen; j++){
					if(crtExcluded[i].Id === selectedProducts[j].Id){
						crtExcluded.splice(i,1);
						break;
					}
				}
			}
			
			var replaceExisting = true;
			this.productCategoryHelper.setExcludes(crtExcluded,replaceExisting);
			this.resetLinkAndSelection();
			this.clearTableSelections();
			this.eventBus.publish("retail.pmr.promotionaloffers", "onAction", {isHierarchy: true});
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
					that.productCategoryHelper.setExcludes(selection);
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
   		getDataExclude: function(){
   			var hierarchy = this.oModel.getProperty("/ProductHierarchy");
   			
   			return this.productCategoryHelper.slimData(hierarchy,false);
   		},
   		resetExcludes: function(){
   			this.oModel.setProperty("/ProductHierarchy",[]);
   			this.productCategoryHelper = new ProductsCategoryHelper(this.masterDataSystem,[],[]);
   			this.setSearch("");
   			this.excludePGFilter.setValue("");
   		}
	});
	
	return productExcludedHierarchy;
});