/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models", 
               "retail/pmr/promotionaloffers/plugins/terms/styles/ProductHierarchyController",
               "retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/ValueHelpDialog"], function(Models, ProductHierarchyController, Utils, ValueHelpDialog){
	
	function eventPromise(bus, channel, okEvent, cancelEvent){
		function unsubscribe(ok, cancel){
			bus.unsubscribe(channel, okEvent, ok);
			bus.unsubscribe(channel, cancelEvent, cancel);
		}
		function subscribe(ok, cancel){
			bus.subscribe(channel, okEvent, ok);
			bus.subscribe(channel, cancelEvent, cancel);
		}
		return new Promise(function(resolve, reject){
			var cancelListener = null,
				okListener = null;
			okListener = function okListener(channel, eventId, data){
				resolve(data);
				unsubscribe(okListener, cancelListener);
			};
			cancelListener = function cancelListener(channel, eventId, data){
				reject(data);
				unsubscribe(okListener, cancelListener);
			};			
			subscribe(okListener, cancelListener);
		});		
	}
	
	
	function productGroupSearch(masterDataSystem, currentSearchValue){		
		var oSettings = {};
		
		//user data/general/type search
		
		var inputTypeValue = currentSearchValue;
		var generalMasterDataSystem = masterDataSystem;
		var i18n = Utils.getI18NModel();
		
		//server connection settings				
		oSettings.service = Models.getServiceModel();
		oSettings.complexSearchUrl = "/TermObjectSearches";			
		oSettings.dimension = "02";				
		oSettings.attributesUrl = "/Attributes";
		oSettings.attributeType = "01";
		oSettings.action = "Search";				
		oSettings.skip = 0;
		oSettings.top = 100;		
		oSettings.topForSearch = 1000;
		
		//default filters
		oSettings.filters = [{"Attribute":"PROD_DIM_TCD","Sign":"I","Option":"EQ","Low":"02"},
		                     {"Attribute":"MD_SYSTEM_REF","Sign":"I","Option":"EQ","Low":generalMasterDataSystem}];
		
		//type search 
		oSettings.inputFilter = inputTypeValue;
		
		//value help dialog settings
		oSettings.searchValue = "";
		oSettings.title = i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup");
		oSettings.supportMultiselect = false;
		oSettings.supportRanges = false;
		oSettings.supportRangesOnly = false;				
		oSettings.stretch = sap.ui.Device.system.phone;
		oSettings.filterAdvancedMode = true;
		oSettings.filterBarExpand = false;
		oSettings.showGoOnFB = true;
		oSettings.FilterPlaceholder = i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.Placeholder");					
		
		//table columns
		oSettings.tableColumns = [{label: i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.Id"), template: "ExtNodeId"},
		  						{label: i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.Name"), template: "Name"},
		  						{label: i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.ExtHierarchy"), template: "ExtHierarchyId"},
		  						{label: i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.Hierarchy"), template: "HierarchyDescription"},
		  						{label: i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.Products"), template: "Cardinality"
								}];
		
		oSettings.oColModelBindName = "columns";
		
		//filters
		oSettings.definedFilters = [{label:i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersDescription"),key:"PROD_HR_DESC"},
		                            {label:i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersNodeId"),key:"EXT_NODE_ID"},
		                            {label:i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersNodeName"),key:"NODE_NAME"},
		                            {label:i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersProductId"),key:"EXT_PROD_ID"},
		                            {label:i18n.getResourceBundle().getText("Terms.Advanced.ProductGroup.FiltersProductName"),key:"PROD_NAME"}];
		//dynamic attributes
		return Models.getTermAttributes("02", "01").then(function(data){
			var resultAttributes = data.data;
			oSettings.productGroupAttributes = resultAttributes;
			var valueHelpDialog = ValueHelpDialog.initCtrl(oSettings, function(column, index){
			if(index === 4){
				column.setHAlign("End");
				column.getLabel().setTextAlign("End");
	 			var oTemplate = new sap.m.Text({ 
	            	text: {   
	            		path: "Cardinality",
	                    formatter: retail.pmr.promotionaloffers.utils.Formatter.productCount
	            	}
	        	}); 
			column.setTemplate(oTemplate);
			}
			});
			valueHelpDialog.addStyleClass("sapUiSizeCompact");
			valueHelpDialog.open();
			return eventPromise(sap.ui.getCore().getEventBus(), "retail.pmr.promotionaloffers", "selectedProductGroup", "cancelProductGroup").then(function(data){
				valueHelpDialog.destroy();
				return Models.getProductById(data.selectedProductGroupItem.Id, "02");
			});
		});
	}
	
	function newProductGroup(masterdataSystem, productGroupName){
		return {
			Dimension: "02",
			ExtHierarchyId: productGroupName,
			ExtNodeId: productGroupName,
			Name: null,
			MasterdataSystem: masterdataSystem,
			Rules: {results: []},
			Node: {results: []},
			Included: {results: []},
			Excluded: {results: []},
			Preview: {results: []},
			HierarchyPreview: {results: []},
			Cardinality: 0
		};
	}

	function createProductGroupPage(pgData, isNew, router){
   		return new Promise(function(resolve, reject){
   			var result = router.navTo("productGroup", true);
   			var view = result.getView("retail.pmr.promotionaloffers.view.ProductGroupTabs", "XML");
   			var controller = view.getController();
   			controller.setResolvers(resolve, reject);
   			controller.setProductGroupData(jQuery.extend(true, {}, pgData), isNew);   			
   		});
   	}

	function findProductGroupByName(masterdataSystem, id, name, termData){
		var oServiceCall = Models.mergeVisibleProducts(masterdataSystem, name, "02", "", termData);
		if (Utils.getSchemaVersion() <= 4) {
		  oServiceCall = Models.getProducts(masterdataSystem, name, "02");
		}
		function findProductGroup(products, id){
			for (var i = 0; i < products.length; i++) {
				if (products[i].HierarchyId === id) {
					return products[i];
				}
			}
			return null;
		}
		return oServiceCall.then(function(data){
			var products = data.Products;
			var result = findProductGroup(products, id);
			if(!result){
				throw new Error("No product was found with name", name, "and id", id, "in", products);
			}
			return result;
		});
	}
	
	
	function ProductGroupController(model, productDetails){
		ProductHierarchyController.call(this, model, productDetails);
		this.router = null;
		this.onCreateProductGroup = this.onCreateProductGroup.bind(this); 
		this.onEditProductGroup = this.onEditProductGroup.bind(this);
		this.onDisplayProductGroup = this.onDisplayProductGroup.bind(this);
	}
	
	var parent = ProductHierarchyController.prototype;
	
	ProductGroupController.prototype = Object.create(parent);
	
	ProductGroupController.prototype.getDimension = function(){
		return "02";
	};
	
	ProductGroupController.prototype.openValueHelpDialog = function(e, mds){
		return productGroupSearch(mds, e.getSource().getValue());
	};
	
	ProductHierarchyController.prototype.setRouter = function(router){
		this.router = router;
	};
	
	function launchProductGroupPage(controller, e, productGroup, create){
		var that = controller;
		var eventClone = jQuery.extend(true, {}, e);
		var path = e.getSource().getBindingContext().getPath();
		var masterdataSystem = controller.masterdataSystemModel.getProperty("/MasterdataSystem");
		var termData = that.model.getProperty(path);

		createProductGroupPage(productGroup, create, controller.router).then(function(result){
			if(result.skipCall) {
				return Promise.resolve(result);
			}
			return findProductGroupByName(masterdataSystem, result.ProductGroup.Id, result.ProductGroup.Name, termData);
		}).then(function(productGroup){
			if(productGroup.skipCall) {
				return;
			}
			that.populateModel(that.model, path, productGroup);
			that.populateUnitOfMeasure(that.model, path, productGroup);
			that.handleProductDetails(that.productDetails, productGroup, that.model.getProperty(path), true);
			that.model.setProperty(path + "/ProductErrorState", "None");
		}, function(error){
			jQuery.sap.log.trace(error);
			that.resetInput(eventClone);
		});
	}
	
	ProductGroupController.prototype.onEditProductGroup = function(e){
		var clonedEvent = jQuery.extend(true, {}, e);
		var path = e.getSource().getBindingContext().getPath();
		var that = this;
		Models.getProductGroupById(this.model.getProperty(path + "/Selection/HierarchyId")).then(function(result){
			var pg = jQuery.extend(true, {}, result);
			launchProductGroupPage(that, clonedEvent, pg, false);
		});
	};
	
	ProductGroupController.prototype.onDisplayProductGroup = function(e){
		var clonedEvent = jQuery.extend(true, {}, e);
		var path = e.getSource().getBindingContext().getPath();
		var that = this;
		Models.getProductGroupById(this.model.getProperty(path + "/Selection/HierarchyId")).then(function(result){
			var pg = jQuery.extend(true, {}, result);
		    pg.Display = true;
			launchProductGroupPage(that, clonedEvent, pg, false);
		});
	};
	
	
	ProductGroupController.prototype.onCreateProductGroup = function(e){
		var clonedEvent = jQuery.extend(true, {}, e);
		var that = this;
		var path = e.getSource().getBindingContext().getPath();
		var masterdataSystem = this.masterdataSystemModel.getProperty("/MasterdataSystem");
		var productGroupName = this.model.getProperty(path + "/ProductTextValue");
		var dummyProductGroup = newProductGroup(masterdataSystem, productGroupName);
		Models.getLeadingCategoriesSet(masterdataSystem).then(function(aLeadingCategoriesSet){
			dummyProductGroup.LeadingCategorySet = aLeadingCategoriesSet;
		});
		launchProductGroupPage(that, clonedEvent, dummyProductGroup, true);
		
	};
	
	function linkVisiblityFormatter(dimension, nodeId, hierarchyId){
		var isProductGroup = dimension === "02";
		var isValidGroup = !!nodeId || !!hierarchyId;
		return isProductGroup && isValidGroup; 
	}
	
	ProductGroupController.prototype.createLinkVisiblityFormatter = function(dimension, nodeId, hierarchyId, productTextValue){
		return !linkVisiblityFormatter(dimension, nodeId, hierarchyId) || productTextValue === null;
	};
	
	ProductGroupController.prototype.editLinkVisiblityFormatter = function(dimension, nodeId, hierarchyId, productTextValue){
		return linkVisiblityFormatter(dimension, nodeId, hierarchyId) && productTextValue !== null;
	};
	
	ProductGroupController.prototype.populateModel = function(model, path, data){
		var result = ProductHierarchyController.prototype.populateModel.apply(this,arguments);
		model.setProperty(path + "/Selection/ExtHierarchyId", data.ExtNodeId);
		model.setProperty(path + "/Selection/ExtHierarchyNodeId", null);
		model.setProperty(path + "/Selection/Products", data.ExtNodeId ? data.Cardinality: 0);
		return result;
	};
	
	return ProductGroupController;
}, true);