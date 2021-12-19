/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
   		"sap/ui/core/mvc/Controller",
   		"sap/ui/model/json/JSONModel",
   		"retail/pmr/promotionaloffers/utils/Utils",
   		"retail/pmr/promotionaloffers/utils/Models",
   		"sap/ui/core/routing/History"
   	], function(Controller, JSONModel, Utils, Models, History) {
   	"use strict";

   	function clearPreviewData(data) {
   		var dataWithoutPreview = {};
   		jQuery.extend(true, dataWithoutPreview, data);
   		delete dataWithoutPreview.PreviewCriteria;
   		return dataWithoutPreview;
   	}
   	
   	function shouldExitDirectly(controller){
   		if(!jQuery.sap.equal(clearPreviewData(controller.snapshot), clearPreviewData(controller.getProductGroupData()))) {
			return false;
		}
		return true;
   	}
   	
   	function createCancelDialog(options){	
   		if(shouldExitDirectly(options.controller)) {
   			return Promise.resolve();
   		}
   		function ok (resolve){
   			resolve();
   		}

   		function cancel(resolve, reject) {
   			reject();
   		}

   		return Utils.createDialogUtil(jQuery.extend(options, {
   			onOk : ok,
   			onCancel : cancel,
   			state : "Warning"
   		}));
   	}
   	   	
   	function controllerById(view,id){
		return view.byId(id).getController();
	}
   	
   	var oMessagePopover = Utils.getErrorHandler().createMessagePopover();
     
   	return Controller.extend("retail.pmr.promotionaloffers.view.ProductGroupTabs", {
   		constructor: function() {
   			this.dataModel = new JSONModel();
   			this.contentModel = new JSONModel();
   		},
   		
   		
   		onInit: function() {
   			this.getView().setModel(this.dataModel);
   			this.getView().setModel(this.contentModel, "Content");
   			this.basicDataController = controllerById(this, "basicDataView");
   			this.defineInclusionsController = controllerById(this, "defineInclusionsView");
   			this.defineExclusionsController = controllerById(this, "defineExclusionsView");
   			this.previewController = controllerById(this, "previewView");
   			this.i18nBundle = Utils.getResourceModel();
   			this.oMessageManager = Utils.getMessageManager();
   			oMessagePopover.setModel(this.oMessageManager.getMessageModel());
   			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "onAction", this.triggerRefreshTables, this);
   			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "reselectTab", this.reselectCurrentActionTab, this);
   			this.snapshot = {};
   			this.getRouter().attachRouteMatched(this.routeMatched, this);
   			this.bNavPressed = false;
   		},
   		
   		routeMatched: function(e) {
   			var history = History.getInstance();
			var lastHash = history.aHistory[history.aHistory.length - 1];
			if (lastHash.indexOf("productGroup") === 0 && e.getParameter("name") !=="productGroup" && !this.bNavPressed) {
				this.resolve({
					ProductGroup : this.productGroupData,
					skipCall: !this.isAfterSave
				});
			}
			this.bNavPressed = false;
   		},
   		
   		onExit : function(){
   			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onAction", this.triggerRefreshTables, this);
   			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "reselectTab", this.reselectCurrentActionTab, this);
   		},
   		
   		getRouter : function () {
   			return sap.ui.core.UIComponent.getRouterFor(this);
   		},
   		
   		getEventBus : function(){
   			return sap.ui.getCore().getEventBus();
   		},
   		
   		onCancel: function() {
   			this.openCancelDialog();
   		},
   		
   		/**
   		 * Creates and opens the confirm dialog when pressing cancel.
   		 * 
   		 * @returns {void}
   		 */
   		openCancelDialog: function() {
   			var cancelDialogOptions = {
   					controller : this,
   					view : this.getView(),
   					title : "{i18n>CreateOffer.OfferCancelDialogTitle}",
   					message : "{i18n>CreateOffer.OfferCancelDialogDescription}",
   					btnOk : "{i18n>CreateOffer.CreateOfferDialog.Accept}",
   					btnCancel : "{i18n>CreateOffer.CreateOfferDialog.Reject}"
   			};
   			var that = this;
   			createCancelDialog(cancelDialogOptions).then(function(){
   				window.history.back();
   	   			that.oMessageManager.removeAllMessages();
   	   			that.defineInclusionsController.resetProductHierarchy();
   	   			that.defineExclusionsController.resetProductHierarchy();
   	   			that.defineInclusionsController.resetProductSearch();
   	   			that.defineExclusionsController.resetProductSearch();
   	   			that.previewController.resetModel();
				that.previewController.resetSearch();
				if(that.productGroupData){
					that.resolve({
						ProductGroup : that.productGroupData,
						skipCall: !that.isAfterSave
					});	
				}else{
					that.resolve(null);
				}
				that.isAfterSave = false;
   	   			that.productGroupData = null;
   			}, Utils.indentity);
   		},
   		
   		onNavButtonPress: function() {
   			this.bNavPressed = true;
   			this.openCancelDialog();
   		},
   		
   		onSave: function() {
   			var that = this;
   			if (!this.verifyValidation()) {
   				return;
   			}
   			
   			Utils.getErrorHandler().showBusy(this.i18nBundle.getResourceBundle().getText("ProductGroupPage.SaveBusyDialog"));
   			var productData = this.getProductGroupData();
   			var payload = this.createSavePayload(productData);
   			payload.Rules = this.formatRulesForTheSameGroup(payload.Rules.concat(productData.HierarchyPayload.Rules));
   			payload.Filters = this.getProductGroupFilters() || [];
   	
   			Models.createNewProductGroup(payload).then(function(data) {
				var resultData = data.data;
				that.oMessageManager.removeAllMessages();
				that.isAfterSave  = true;
				that.getEventBus().publish("retail.pmr.promotionaloffers", "afterPGSaved", {dataProductGroup: resultData});
				that.setProductGroupData(resultData, false);
				Utils.getErrorHandler().hideBusy();
				Utils.getErrorHandler().showToast(that.i18nBundle.getResourceBundle().getText("ProductGroupPage.ToastMessage.SaveCompleted"));
			}, function(e) {	
				Utils.getErrorHandler().hideBusy();
			});
  			
   		},
   		
   		formatRulesForTheSameGroup: function(rules) {
   			for (var i = 0; i < rules.length; i++) {
				var number = i + 1;
				rules[i].GroupId = this.dataModel.getProperty("/Id");
				rules[i].Number = number;
   			}
   			return rules;
   		},
   		
   		verifyValidation: function() {
   			var tabs = [];
   			if(this.basicDataController.validateForm()) {
   				tabs.push(this.i18nBundle.getResourceBundle().getText("ProductGroupPage.BasicData.Title"));
   			}
   			
   			if(tabs.length) {
   				var sMsg = this.i18nBundle.getResourceBundle().getText("CreateOffer.SaveOffer.Validate", tabs.join(", "));
   				Utils.getErrorHandler().showError(sMsg);
   	   			return false;
   			}
   			
   			return true;
   		},
   		
   		setResolvers : function(resolve, cancel){
			this.resolve = resolve;
			this.cancel = cancel;
   		},
   		
   		getCurrentMasteDataSystem: function(currentMasterSystemDataId) {
   			var that = this;
   			Models.getMasterDataSystems().then(function(aSystems) {
  			  if(aSystems.length === 0){
  				that.contentModel.setProperty("/CurrentMasterDataSystem", ""); 
  			  }
  			  aSystems = aSystems.map(function(oItem) {
  				  if (oItem.Id === currentMasterSystemDataId) {
  					that.contentModel.setProperty("/CurrentMasterDataSystem", oItem.System || oItem.Description);
  				  }
  			  });
  		  });
   		},
   		
   		mergePayloads : function(includePayload,excludePayload){
   			var toReturn = jQuery.extend({},includePayload);
   			toReturn.Rules = toReturn.Rules.concat(excludePayload.Rules);
   			
   			return toReturn;
   		},
   		getProductGroupData: function() {
   			var defineInclusionsData = this.defineInclusionsController.getProductGroupData();
   			var defineExclusionsData = this.defineExclusionsController.getProductGroupData();
   			
   			var hierarchyPayload = this.mergePayloads(defineInclusionsData.Payload, defineExclusionsData.Payload);
   			
   			return {
   				Basic: {
   					Name: this.basicDataController.getProductGroupData().Name,
   					Description: this.basicDataController.getProductGroupData().Description
   				},
   				Included: defineInclusionsData.Included || [],
   				Excluded: defineExclusionsData.Excluded || [],
				HierarchyPayload: hierarchyPayload,
   				PreviewCriteria: this.previewController.getProductGroupData()

   			};
   		},
   		getProductGroupFilters: function(){
   			var pgFilters = this.defineInclusionsController.getPGFilters();
   			
   			return pgFilters;
   		},
   		
   		setProductGroupData : function(productGroupData, isNew){
   			this.productGroupData = jQuery.extend(true, {}, productGroupData);
   			this.oMessageManager.removeAllMessages();
			this.dataModel.setData(productGroupData);
			var name = productGroupData.Name || productGroupData.ExtNodeId || productGroupData.ExtHierarchyId || "";
			this.dataModel.setProperty("/Name", name);
			this.contentModel.setProperty("/ReadOnly", !!productGroupData.Display);
			this.contentModel.setProperty("/IsNew", isNew);
			this.contentModel.setProperty("/NavButtonsEnabled", !productGroupData.Display);
			this.basicDataController.setProductGroupData(productGroupData, isNew);	
			this.defineInclusionsController.setProductGroupData(productGroupData, isNew);
			this.defineExclusionsController.setProductGroupData(productGroupData, isNew);
			this.previewController.setProductGroupData(productGroupData, true);
			this.getCurrentMasteDataSystem(productGroupData.MasterdataSystem);
			this.snapshot = jQuery.extend(true, {}, this.getProductGroupData());
   		},
   		
   		updateTablesData: function(data, isIncluded, isHierarchy) {
   			if (isHierarchy) {
   				return data;
   			}
   			if (isIncluded) {
   				data.Excluded = this.removeTheSameData(data.Excluded, data.Included);	
   			} else {
   				data.Included = this.removeTheSameData(data.Included, data.Excluded);
   			}
   			return data;
   		},
   		
   		removeTheSameData: function(removeFrom, keepIn) {
   			if (keepIn && removeFrom) {
   				keepIn.forEach(function(item) {
   					for (var i = 0; i < removeFrom.length; i++) {
   						if (item.Id === removeFrom[i].Id) {
   							removeFrom.splice(i, 1);
   						}
   					}
   					
   				});
   			}
   			return removeFrom;
   		},
   		
   		
   		triggerRefreshTables: function(channel, event, context) {
   			var that = this;
   			var productData = this.getProductGroupData();
   			var updatedData = this.updateTablesData(productData, context.isIncluded, context.isHierarchy);	
   			var payload = this.createSavePayload(updatedData, context.isPreviewAction);
   			payload.Rules = this.formatRulesForTheSameGroup(payload.Rules.concat(productData.HierarchyPayload.Rules));
   			payload.Filters = this.getProductGroupFilters() || [];
   			
   			if (!context.isPreviewAction) {
	   			that.defineInclusionsController.setTableState(true, context.isHierarchy);
				that.defineExclusionsController.setTableState(true, context.isHierarchy);
   			}
   			if (context.isPreviewAction && context.NodeId) {
   				payload.NodeId = context.NodeId;
   			} else {
   				that.previewController.setTableState(true);
   			}	
			Models.getProductsInPG(payload).then(function(data) {
				var resultData = data.data.data;
				if (context.isPreviewAction) {
					if (context.NodeId) {
						if (context.launchPopUp) {
							that.previewController.launchProductDialog(resultData);
						} else {
							that.previewController.setPopUpData(resultData);
						}
						return;
					}
					that.previewController.setProductGroupData(resultData);
					jQuery.sap.delayedCall(300, that, function(){
						that.previewController.setTableState(false);
					});	
					return;
				}
				that.defineInclusionsController.setProductGroupData(resultData);
				that.defineExclusionsController.setProductGroupData(resultData);
				that.previewController.setProductGroupData(resultData, true);
				jQuery.sap.delayedCall(300, that, function(){
					that.defineInclusionsController.setTableState(false, context.isHierarchy);
					that.defineExclusionsController.setTableState(false, context.isHierarchy);
					that.previewController.setTableState(false);
				});	
				that.dataModel.setData(resultData);
			}, function() {					
			});
   		},
   		
   		reselectCurrentActionTab: function(channel, event, context) {
   			var tabs = this.byId("ObjectPageLayout");
   			var currentTabId = tabs.getScrollingSectionId();
   			if (context.indexSection) {
   				currentTabId = tabs.getSections()[context.indexSection].getId();
   			}	
   			tabs.scrollToSection(currentTabId);
   		},
   		
   		onMessagesIndicatorPress: function(oEvent) {
			oMessagePopover.openBy(oEvent.getSource());
	   	},
	   	
	   	createSavePayload: function(productGroupItems, isPreviewAction) {	
	   		this.rules = [];
	   		this.createRules(productGroupItems.Included, true);
	   		this.createRules(productGroupItems.Excluded, false);
			return {
				  "Id": this.dataModel.getProperty("/Id"),
				  "Skip": isPreviewAction ? productGroupItems.PreviewCriteria.Skip.toString() : "0",
				  "Top": isPreviewAction ? productGroupItems.PreviewCriteria.Top.toString() : "21",
				  "Search": productGroupItems.PreviewCriteria.Search,
				  "Name": productGroupItems.Basic.Name,
				  "Description": productGroupItems.Basic.Description,
				  "MasterdataSystem": this.dataModel.getProperty("/MasterdataSystem"),
				  "Rules": this.rules,
				  "Nodes": [],
				  "Included": [],
				  "Excluded": [],
				  "Preview": [],
				  "HierarchyPreview": []
				};

		},
		
		createRules: function(productGroupItems, isIncluded) {
			for (var i = 0; i < productGroupItems.length; i++) {
				var number = i + 1;
				var rule = {
						"GroupId" : "0",
						"Number" : number,
						"Sign" : isIncluded ? "I" : "E",
						"Dimension" : "01",
						"ReferenceId" : productGroupItems[i].Id
				};
				this.rules.push(rule);
			}
			
			return this.rules;
		}		

   	});

});