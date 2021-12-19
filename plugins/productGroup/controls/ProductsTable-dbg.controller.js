/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/Models"
	], function(Controller, JSONModel, Utils, Models) {

	"use strict";
   	
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.controls.ProductsTable", {
		
		constructor : function(){
			this.contentModel = new JSONModel();
			this.dataModel = new JSONModel();
			this.timeModel = new JSONModel();
		},
		
		onInit: function() {
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);

			var resourceModel = Utils.getResourceModel();
			this.getView().setModel(resourceModel, "i18n");
			
			this.contentModel.setProperty("/Editable", true);
			this.oMessageManager = Utils.getMessageManager();
			this.i18nModel = Utils.getResourceModel();
			
			this.componentId = Utils.getComponent().getId();
			this.productSearchField = this.getView().byId("productFilterId");
			
			this.busyIndicator = new sap.m.BusyDialog({
				text : "Importing products, please wait"
			});
			
		},
		
		getEventBus : function(){
   			return sap.ui.getCore().getEventBus();
   		},
		
		getProductGroupData : function() {
			var oData = jQuery.extend({}, this.dataModel.getData());
			return oData;
		},
		resetSearchField: function(){
			this.productSearchField.setValue("");
		},
		setProductGroupData : function(data, isIncluded) {	
			this.dataModel.setData(data);
			this.contentModel.setProperty("/ReadOnly", !!data.Display);
			this.contentModel.setProperty("/EnableDelete", false);
			this.contentModel.setProperty("/IsIncluded", isIncluded);
			this.contentModel.setProperty("/EnableMultipleAdd", isIncluded);
			var productGroupItems = this.getCorrectData(data);
			this.contentModel.setProperty("/ProductGroupItems", productGroupItems);	
			this.setCurentModelData(productGroupItems);			
		},
		
		getTable: function() {
   			return this.getView().byId("productsTable");
   		},
   		
   		getCurentModelData: function() {
   			var property = "/Excluded";
   			if (this.contentModel.getProperty("/IsIncluded")) {
   				property = "/Included";
   			}
   			var toReturn = this.dataModel.getProperty(property);
   			return toReturn;
   		},
   		
   		setCurentModelData: function(data) {
   			var property = "/Excluded";
   			if (this.contentModel.getProperty("/IsIncluded")) {
   				property = "/Included";
   			}
   			this.dataModel.setProperty(property, data);
   		},
   		
   		getCorrectData: function(data) {
   			var productGroupItems = [];
			if (data) {
				if (this.contentModel.getProperty("/IsIncluded")) {
					productGroupItems = data.Included ? data.Included.results : [];
				}else {
					productGroupItems = data.Excluded ? data.Excluded.results : [];
				}
			} 
			return productGroupItems;
   		},
		
		launchSearchProductsDialog: function() {
			var that = this;
			return new Promise(function(resolve, reject) {
				var sPath = "retail.pmr.promotionaloffers.plugins.terms.controls.search.ProductSearchPage";
				var oController = sap.ui.controller(sPath);
				var oFragment = sap.ui.xmlfragment(sPath, oController);
				oFragment._sOwnerId = that.componentId;
				var i18nTitle = "Terms.Advanced.Product.Title";
				var masterDataSystem = that.getView().getModel().getProperty("/MasterdataSystem");
				oController.onInit(oFragment, masterDataSystem, null, i18nTitle, resolve, reject, true, that.getCurentModelData());
			});
		},
		
		launchProductImportDialog : function(){
			var that = this;
			return new Promise(function(resolve, reject){
				
				function notBlank(item){
					return !!item.trim();
				}
				
				function dedup(item, index, results){
					return results.indexOf(item) === index;
				}
				
				
				function makeTokens(strings){
					return strings.map(makeToken);
				}
				
				var state = { productIds : [] };
				var view = null;
				
				function render(view, state){
					if(!view){
						return;
					}
					var productIds = state.productIds;
					view.setTokens(makeTokens(productIds));
					view.setValue(null);
				}
				
				function actionHandler(state, action){
					switch(action.type){
						case "ADD_ITEMS":
							var currentIds = state.productIds;
							var newIds = action.payload;
							var allIds = currentIds.concat(newIds).filter(dedup);
							return {
								productIds : allIds 
							};
						case "DELETE_ITEM":
							var ids = state.productIds;
							var toBeRemoved = action.payload;
							return { 
								productIds : ids.filter(function(item){
									return toBeRemoved.indexOf(item) === -1;
								})
							};
						default:
							return state;
					}
				}
				
				function dispatch(action){
					state = actionHandler(state, action);
					render(view, state);
				}
				
				function makeToken(item){
					var token = new sap.m.Token({
						text : item,
						key : item 
					});
					return token;
				}
				
				function strContainsAny(str, chars){
					for(var i = 0; i<chars.length; i++){
						if(str.indexOf(chars[i]) > -1){
							return true;
						}
					}
					return false;
				}
				
				var controller = {
					onInit : function(e){
						view = e.getSource();
						render(view, state);
					},
					handleOkPress : function(e){
						resolve(state.productIds);
						this.close(e);
					},
					handleCancelPress : function(e){
						reject();
						this.close(e);
					},
					close : function(e){
						var dialog = e.getSource().getParent();
						dialog.close();
						dialog.destroy();
					},
					onChange : function(e){
						
						var value = e.getParameter("value");
						if(strContainsAny(value, [";", ",", " ", "\n"])){
							var imports = value.replace(/;/g, ";").replace(/\n/g, ";").replace(/ /g, ";").split(";"); 
							var productIds = imports.filter(notBlank);
							dispatch({ type : "ADD_ITEMS", payload : productIds });
						}
						
					},
					onTokenUpdate: function(oEvent){
						var aRemovedTokens = oEvent.getParameter("removedTokens");
						var aProductIDs = [];
						for (var i = 0; i < aRemovedTokens.length; i++) {
							aProductIDs.push(aRemovedTokens[i].getText());
						}
						if(aProductIDs.length > 0){
							dispatch({ type : "DELETE_ITEM", payload : aProductIDs });
						}
					}					
				};
				var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.productGroup.controls.ProductImportDialog", controller);
				
				dialog.setModel(that.i18nModel, "i18n");
				dialog.open();
			});
		},
		
		setTableState: function(busy) {
			this.getTable().setBusy(busy);
		},
		
		removeTableSelections: function() {
			this.getTable().removeSelections(true);
		},
		
		triggerOnAction : function(){
			var isIncluded = this.contentModel.getProperty("/IsIncluded");
			this.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", {isIncluded: isIncluded});
		},
		
		handleAddPress: function() {
			var that = this;
			this.launchSearchProductsDialog().then(function(productGroupItems) {
				that.setCurentModelData(productGroupItems);
				that.triggerOnAction();
			});
		},			
		
		handleAddMultiplePress : function(){
			var that = this;
			var masterDataSystem = this.getView().getModel().getProperty("/MasterdataSystem");
			
			function diffImportedWithNeeded(imported, needed){
				return needed.reduce(function(diff, id){
					var item = imported.filter(function(product){
						return product.ExtNodeId.toString().toUpperCase() === id; 
					});
					
					if(!item.length){
						diff.push(id);
					}
					
					return diff;
				}, []);
			}
			
			function getText(bundle, text/*, ...args*/){
				var args = Array.prototype.splice.call(arguments, 0);
				args.splice(0, 2);
				var result = [bundle.getText(text)].concat(args);
				return jQuery.sap.formatMessage.apply(null, result);
			}
			
			function validateImport(i18nBundle, imported, needed){
				var fakePath = "/ProductGroupPage/Messages";
				Utils.removeMessagesByPath(fakePath);
				
				var diff = diffImportedWithNeeded(imported, needed);
				var completeSucessfullImport = diff.length === 0;
				if(completeSucessfullImport){
					var importOkText = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultipleSuccess", imported.length);
					sap.m.MessageBox.information(importOkText);
				}else{
					var importBadText = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultipleFailed", diff.length, needed.length);
					sap.m.MessageBox.warning(importBadText);
					var messages = diff.map(function(id){
						var message = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultipleFailedWarnTitle", id);
						var desc = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultipleFailedWarnDesc", id);
						return {
							target : fakePath,
							message : message,
							description : desc,
							type : "Warning",
						};
					});
					var partialSuccessTitle = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultiplePartialSuccessTitle",  imported.length);
					var importedItems = imported.map(function(item){ return item.ExtNodeId; }).join(", ");
					var partialSuccessDesc = getText(i18nBundle, "ProductGroupPage.ProductsTable.AddMultiplePartialSuccessDesc", importedItems);
					messages.push({
						message: partialSuccessTitle,
						description: partialSuccessDesc,
						type: "Success",
						target : fakePath
					});
					
					Utils.setErrorMessages(Utils.getMessageManager(), messages, new JSONModel());
					
				}
			}
			
			this.launchProductImportDialog().then(function(extProductIds){
				that.busyIndicator.open();
				var existingProducts = that.contentModel.getProperty("/ProductGroupItems");
				var extProductIdsUpperCase = extProductIds.map(function(extProductId){
					return extProductId.toString().toUpperCase();
				});
				existingProducts = existingProducts.filter(function(product) {
					return extProductIdsUpperCase.indexOf(product.ExtId) === -1;
				});
				return Models.fetchProductsByExternalIds(masterDataSystem, extProductIdsUpperCase).then(function(products){
					that.busyIndicator.close();
					
					validateImport(that.i18nModel.getResourceBundle(), products, extProductIdsUpperCase);
					that.setCurentModelData(products.concat(existingProducts));
					that.triggerOnAction();
					
				}, function(error){
					try{
						var actualError = JSON.parse(error.responseText).error;
						var code = actualError.code;
						if(code === "/IWFND/CM_BEC/026"){
							sap.m.MessageBox.error(that.i18nModel.getResourceBundle().getText("ProductGroupPage.ProductsTable.AddMultipleFailedToManyItems"));
						}else{
							sap.m.MessageBox.error(that.i18nModel.getResourceBundle().getText("ProductGroupPage.ProductsTable.AddMultipleFailedGeneric"));
						}
					}catch(e){
						sap.m.MessageBox.error(error.statusText);
					}
					that.busyIndicator.close();
				});
			}, Utils.identity);
		},
		
		onLiveChange: function(oEvent){
			var searchValue = oEvent.getParameter("newValue");
			this.searchAfterAValue(searchValue);
		},
		
		
		onSearch: function(oEvent){
			var searchValue = oEvent.getParameter("query");
			this.searchAfterAValue(searchValue);
		},
		
		searchAfterAValue: function(searchValue) {
			var model = jQuery.extend(true, [], this.getCurentModelData());
			
			var products = model.filter(function(item){				
				return (item.Name.indexOf(searchValue) > -1) || (item.ExtId.indexOf(searchValue) > -1);					
			});		
			this.contentModel.setProperty("/ProductGroupItems", products);
			this.getTable().removeSelections(true);
		},
	
		
		onRowSelected: function(oEvent) {
			var that = this;
			this.selectedProducts = [];
			this.oSelectedItems = oEvent.getSource().getSelectedItems();
			this.oSelectedItems.forEach(function(item) {
				that.selectedProducts.push(item.getBindingContext("Content").getObject());
			});
			
			this.contentModel.setProperty("/EnableDelete", false);
			if (this.oSelectedItems && this.oSelectedItems.length > 0) {
				this.contentModel.setProperty("/EnableDelete", true);
			}
		},
		
		getProductIndex: function(products, currentProduct) {
			var index = -1;
			for (var i = 0; i < products.length; i++) {
				if (currentProduct.Id === products[i].Id) {
					index = i;
					break;
				}
			}
			return index;
		},
		
		handleDeletePress: function(oEvent) {
			var selectedItems = this.selectedProducts;
			if (selectedItems.length === 0) { 
				return;
			}
			var dialogProperties = {
					"massageSingle" : "",
					"messageMulti" : "ProductGroupPage.DeleteProductsDialog.Message", 
					"title" : "ProductGroupPage.DeleteProductsDialog.Title"
			};
			var that = this;
			Utils.openDeleteConfirmDiaog(false, dialogProperties).then(function() {
				var existingProducts = that.getCurentModelData();
				selectedItems.forEach(function(item) {		
					var index = that.getProductIndex(existingProducts, item);
					if (index > -1) {
						existingProducts.splice(index, 1);
					}
				});
				var isIncluded = that.contentModel.getProperty("/IsIncluded");
				that.getEventBus().publish("retail.pmr.promotionaloffers", "onAction", {isIncluded: isIncluded});
			});	
		}
		
		
	});
});