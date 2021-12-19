/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
   		"sap/ui/core/mvc/Controller",
   		"retail/pmr/promotionaloffers/utils/Models",
   		"retail/pmr/promotionaloffers/utils/Utils",
   		"retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
   		"retail/pmr/promotionaloffers/utils/OfferOperations",
   		"retail/pmr/promotionaloffers/utils/Formatter",
   		"sap/ui/model/json/JSONModel"
   	], function(Controller, Models, Utils, TreeValueHelpDialog, OfferOperations, Formatter, JSONModel) {
   	"use strict";

   	var oMessagePopover = Utils.getErrorHandler().createMessagePopover();
          
   	var hasSameMD = function(data) {
		var firstMD = data[0].MasterdataSystem;
		return data.every(function (item) {
			return item.MasterdataSystem === firstMD;
		});
	};
   	return Controller.extend("retail.pmr.promotionaloffers.view.ManageOffers", {
   		onInit : function() {
   			this.content = new JSONModel({
   				DeleteEnabled: false,
   				EditEnabled: false,
   				Editable: false,
   				OfferFunctionsEnabled: false,
   				CollisionEnabled: false,
   				ContentEnabled: false
   			});
   			this.featuresAvailable = new JSONModel();
   			this.model = Models.getServiceModel();
   			this.getView().setModel(this.content, "Content");
   			this.getView().setModel(this.model);
   			this.getView().setModel(this.featuresAvailable, "featuresAvailable");
   			this.offersSmartTable = this.getView().byId("offers");
   			this.offers = this.getView().byId("offersTable");
   			this.oBus = sap.ui.getCore().getEventBus();
   			this.i18nModel = this.getOwnerComponent().getModel("i18n");

   			this.oMessageManager = Utils.getMessageManager();
   			oMessagePopover.setModel(this.oMessageManager.getMessageModel());

   			this.oRouter = this.getRouter();
   			this.oBus.subscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.onMasterDataSystemChange, this);
   			
   			this.getRouter().attachRouteMatched(function(e) {
   				var sPathName = e.getParameter("name");
   				if (sPathName === "manage") {
   					this.model.refresh(true);
   	   				this.refreshOffersTable();
   				}
   			}.bind(this));
   			
   			Utils.addMasterdataSystemButton(this.oBus, this.i18nModel);
   			this.setFeaturesAvailable();
   			this.offerOperations = new OfferOperations(this.getOwnerComponent().getState());
   		},

   		onExit : function() {
   			this.oBus.unsubscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.onMasterDataSystemChange, this);
   		},

   		onBeforeRebindTable : function(oEvent) {
   			this.oMessageManager.removeAllMessages();
   			var oBindingParams = oEvent.getParameter("bindingParams");
   			oBindingParams.parameters.countMode = sap.ui.model.odata.CountMode.Inline;
   			var query = oBindingParams.parameters.select;
   			var fieldsFromSort = Utils.getFieldsFromSort(oBindingParams.sorter);
   			// If we don't know what status field should we use, then use the metaModel to find it
   			if(!Utils.getStatusField()) {
   				// This will be executed once
   				if (Utils.hasEntitySetProperty("UIState", "Offers", oEvent.getSource().getModel().getMetaModel())) {
   					Utils.setStatusField("UIState");
   	   			} else {
   	   				Utils.setStatusField("Status");
   	   			}
   			}
   			oBindingParams.parameters.select = Utils.attachFieldsToQuery(["OfferId", "Editable", "OfferSetId", "PromotionType", 
   																		  "MasterdataSystem", "PurchasingGroup", "PurchasingGroupName",
   																		  "LeadingCategoryName", "LeadingCategory"]
   																		 .concat(Utils.getStatusForSearch())
   																		 .concat(fieldsFromSort), query);   			
   		},

   		onNavButtonPress: function() {
   			//Go back only if there is a history. Otherwise stay on the page
   			var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
            	window.history.go(-1);
                this.refreshOffersTable();
			}
   		},

   		onMasterDataSystemChange: function(sChannelId, sEventId, oContext) {
   			Models.setMasterDataSystemPersonalization(oContext.MasterdataSystemId);
   		},

   		copyOffer: function(offer){
   			this.oRouter.navTo("copy", {
   				path :  Utils.base64ToHex(offer.OfferId)
   			});

   		},
   		
   		setFeaturesAvailable: function() {
   			var Model = this.getModels();
   			Model.getFeaturesAvailable().then(function(data) {
   				if(!data && !data.length) {
   					return;
   				}
   				var result = Utils.setupFeatures(data);
   				this.featuresAvailable.setData(result);
   			}.bind(this), Utils.handleErrors);
   		},
   		
   		/**
   		 * Triggered when delete offer button is pressed
   		 *
   		 * @returns {void}
   		 */
   		handleDeletePress: function() {
   			this.oMessageManager.removeAllMessages();
   			Utils.openDeleteConfirmDiaog().then(function() {
   				this.batchDelete();
   			}.bind(this));
   		},

   		/**
   		 * Performs offers batch delete.
   		 *
   		 * @returns {void}
   		 */
   		batchDelete: function() {
   			var selectedOffers = this.offers.getSelectedContextPaths().map(function(sPath) {
   				return sPath.split("'")[1];
   			});

   			if (!selectedOffers.length) {
   				return;
   			}
   			
   			var oBundle = this.i18nModel.getResourceBundle();
   			Utils.getErrorHandler().showBusy(oBundle.getText("CreateOffer.BusyIndicatorDeleteOffer.LoadingMessage"));
   			
   			Models.deleteOffers(selectedOffers).then(function(oResponse) {
   				Utils.getErrorHandler().hideBusy();
   				if (Utils.getErrorHandler().numOfErrors(this.oMessageManager) > 0) {
   					Utils.getErrorHandler().showError(oBundle.getText("ManageOffers.MassDelete.Error"));
   				} else {
   					Utils.getErrorHandler().showToast(oBundle.getText("ManageOffers.MassDelete.Success"));
   				}
   				this.model.refresh(true);
   				this.refreshOffersTable();
   			}.bind(this), function(e) {
   				Utils.getErrorHandler().hideBusy();
   				Utils.handleErrors(e);
   			});
   		},

   		toggleToolbarButtons: function(oEvent){
   			var aSelectedContexts = oEvent.getSource().getSelectedContexts();
   			var iSelectedRows = aSelectedContexts.length;
   			
   			this.content.setProperty("/OfferFunctionsEnabled", !!iSelectedRows);

   			this.content.setProperty("/EditEnabled", false);
   			this.content.setProperty("/Editable", false);
   			this.content.setProperty("/CollisionEnabled", false);
   			this.content.setProperty("/ContentEnabled", false);
   			
   			if (iSelectedRows === 1) {   				
   				this.content.setProperty("/Editable", true);
   				this.content.setProperty("/CollisionEnabled", true);
   				this.content.setProperty("/EditEnabled", true);
   				this.content.setProperty("/ContentEnabled", true);
   			} else if (iSelectedRows > 1) {
   				this.content.setProperty("/EditEnabled", true);
   			}
   			
			this.content.setProperty("/DeleteEnabled", !!iSelectedRows);
   		},

	   	createOfferPressed : function() {
	   		this.oMessageManager.removeAllMessages();
	   		this.getRouter().navTo("create");
	   	},

	   	/**
		 * Triggered when copy button is pressed.
		 *
		 * @returns {void}
		 */
	   	copyOfferPressed: function() {
	   		this.oMessageManager.removeAllMessages();
	   		var oOffer = this.offers.getSelectedItem().getBindingContext().getObject();
	   		Utils.navTocopyOffer(this.oRouter, oOffer);
	   	},

	   	getRouter : function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		updateMultipleOffers: function(oData) {
			var keys = Object.keys(oData);
			var result = {};
			for(var i = 0; i < keys.length; i++) {
				if (oData[keys[i]].Selected) {
					if (oData[keys[i]].map.Name && oData[keys[i]].map.Id) {
						result[oData[keys[i]].map.Name] = oData[keys[i]].map.Id === "PurchasingGroup" ? "" : oData[keys[i]].Value;
						result[oData[keys[i]].map.Id] = oData[keys[i]].Id;
					}
					else if(oData[keys[i]].hasOwnProperty("Id")){
						result[keys[i]] = oData[keys[i]].Id;
					}
				}
			}
			if (Object.keys(result).length === 0) {
				return;
			}
			if(result.EndOfOffer){
				result.EndOfOffer = Utils.getFormatedDateForSave(result.EndOfOffer);
			}
			if(result.StartOfOffer){
				result.StartOfOffer = Utils.getFormatedDateForSave(result.StartOfOffer);
			}
			var aSelOffers = this.getSelectedOffers();
			var aSelItems = this.offers.getSelectedItems();
			var oModel = this.model;
			
			Utils.getErrorHandler().showBusy(this.i18nModel.getResourceBundle().getText("ManageOffers.UpdateMultipleOffers"));
	   		
			Models.updateOffers(result, aSelOffers, aSelItems).then(function() {
	        	oModel.refresh(true);
	        	Utils.getErrorHandler().hideBusy();
			}, function(e){
   				Utils.handleErrors(e);
   				Utils.getErrorHandler().hideBusy();
   			});
		},

		createMultipleEditDialog: function (data) {
			var that = this;
			var oDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.MassChangeDialog", {
				onAfterClose: function() {
					oDialog.destroy();
					oDialog = null;
				},
				onCancelPress: function() {
					oDialog.close();
				},
				onOkPress: function() {
					that.updateMultipleOffers(oDialog.getModel("Data").getData());
					oDialog.close();
					oDialog.destroy();
					oDialog = null;
				},
				offerSetValueChanged: function(oEvent) {
					oDialog.getModel("Data").setProperty("/OfferSetId/Value", oEvent.getParameter("newValue"));
	   			},
	   			promotionTypeValueChanged: function(oEvent) {
					oDialog.getModel("Data").setProperty("/PromotionType/Value", oEvent.getParameter("newValue"));
	   			},
	   			purchasingGroupValueChanged: function(oEvent) {
					oDialog.getModel("Data").setProperty("/PurchasingGroup/Value", oEvent.getParameter("newValue"));
	   			},
				handleLeadingCategoryComplexSearch: function() {
   					var leadingCategory = oDialog.getModel("Data").getData().LeadingCategoriesSet || [];
   					TreeValueHelpDialog.openDialog({
   						tableFragment: "retail.pmr.promotionaloffers.plugins.general.LeadingCategoryComplexSearch",
   						title : "{i18n>CreateOffer.MerchCategorySearch.Title}",
   						filterProps : ["ExtId","Name","HierarchyDescription","ExtHierarchyId"],
   						values : Utils.buildHierarchy(leadingCategory, "LeadingCategory")
   					}).then(function(selection){
   						oDialog.getModel("Data").setProperty("/LeadingCategory/Value", selection.ExtId);
   		   				oDialog.getModel("Data").setProperty("/LeadingCategory/Id", selection.Id);
   					});
   				}
			});
			oDialog.setModel(Utils.getI18NModel(), "i18n");
		

			var dataModel = new JSONModel(data);
			oDialog.setModel(dataModel, "Data");
			oDialog.setModel(Models.getServiceModel());
   			oDialog.open();
   			
   			return oDialog;
		},

		addDataMultipleEdit: function (dialog, data) {
			var dataModel = dialog.getModel("Data");
			var initialData = dataModel.getData();
			jQuery.extend(data, initialData);
			dataModel.setData(data);
		},

		

		/* Gets an array of offers and return processed object
		 * With all common values, blank if different
		 * And disable all MD dependent fields that have different MD */
		processOffersMultipleEdit: function (data) {

			var PREDEFINED_KEYS = [{
				Key: "OfferSetId",
				MDDependent: false,
				Name: "OfferSetName",
				Id: "OfferSetId"
			}, {
				Key: "PromotionType",
				MDDependent: true,
				Name: "PromotionTypeDescription",
				Id: "PromotionType"
			}, {
				Key: "LeadingCategory",
				MDDependent: true,
				Name: "LeadingCategoryName",
				Id: "LeadingCategory"
			}, {
				Key: "PurchasingGroup",
				MDDependent: true,
				Name: "PurchasingGroupName",
				Id: "PurchasingGroup"
			}, {
				Key: "StartOfOffer",
				MDDependent: false,
				Name: null,
				Id: null
			}, {
				Key: "EndOfOffer",
				MDDependent: false,
				Name: null,
				Id: null
			}];

			function getItemsByKey(key) {
				return data.map(function (item) {
					return item[key];
				});
			}

			function collapse(array) {
				function getUTCDate(date) {
					return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
				}
				function getDate(result, item) {
					if(!result || !item) { 
						return null;
					}
					return getUTCDate(result).getTime() === getUTCDate(item).getTime() ? getUTCDate(item) : null;
				}

				function getItem(result, item) {
					return item === result ? item : "";
				}

				return array.reduce(function(result, item) {
					return item instanceof Date ? getDate(result, item) : getItem(result, item);
				}, array[0]);
			}

			function getResult (result, item, value, name, sameMD) {
				// value is undefined when the item.Key key is not found in the data
				if (value !== undefined) {
					if (item.Key === "StartOfOffer" || item.Key === "EndOfOffer") {
						value = value ? Utils.addTimezoneOffset(value) : null;
					}
					result[item.Key] = {
						Value: name,
						Id: !item.MDDependent || sameMD ? value : null,
						Selected: false,
						Enabled: !item.MDDependent || sameMD,
						map: {
							Name: item.Name,
							Id: item.Id
						}
					};
				}
				return result;
			}

			return PREDEFINED_KEYS.reduce(function (result, item) {
				var value = collapse(getItemsByKey(item.Key));
				var name = collapse(getItemsByKey(item.Name));
				var sameMD = hasSameMD(data);

				return getResult(result, item, value, name, sameMD);
			}, {});
		},

		getModels: function () {
			return Models;
		},

		addMDDependentSets: function (dialog, masterdataSystem) {
   			dialog.getModel("Data").setProperty("/LeadingCategory/Busy", true);
   			
			var oLeadingCategoriesPromise = this.getModels().getLeadingCategoriesSet(masterdataSystem).then(function (aLeadingCategoriesSet) {
   				this.addDataMultipleEdit(dialog, {
   					LeadingCategoriesSet: aLeadingCategoriesSet
   				});
   			}.bind(this), Utils.handleErrors);

			var oPromotionTypesPromise = this.getModels().getPromotionTypeSet(masterdataSystem).then(function (data) {
   				this.addDataMultipleEdit(dialog, {
   					PromotionTypeSet: data
   				});
   			}.bind(this), Utils.handleErrors);

   			var oPurchasingGroupsPromise = this.getModels().getPurchasingGroupSet(masterdataSystem).then(function (data) {
   				this.addDataMultipleEdit(dialog, {
   					PurchasingGroupSet: data
   				});
   			}.bind(this), Utils.handleErrors);
   			
   			Promise.all([oLeadingCategoriesPromise, oPromotionTypesPromise, oPurchasingGroupsPromise]).then(function(){
   				dialog.getModel("Data").setProperty("/LeadingCategory/Busy", false);
   			});
		},

		editMultipleOffers: function (data) {
			//Validate that all offers can be edited in the app
			var resourceBundle = this.i18nModel.getResourceBundle();
			
			function hasBadStatus(offer){
				var obj = {Status: offer.Status, UIState: offer.UIState};
				return Utils.isEditableHeader(obj) || Utils.isReadOnly(obj);
			}
			
			function notEditable(offer){
				return offer.Editable === false;
			}
			
			function isUneditable(offer){
				return notEditable(offer) || hasBadStatus(offer);
			}
			
			function itemAt(item, index, array){
				return array.indexOf(item) === index;
			}
			
			function getOfferStatus(offer){
				return offer.StatusName;
			}	
			
			/**
			 * formats an array of statuses into a human readable format
			 * for ["Approved"] -> "Approved"
			 * for ["Approved", "Recommended"] -> "Approved or Recommended"
			 * for ["Approved", "Recommended", "Other"] -> "Approved, Recommended or Other"
			 * for ["Approved", "Recommended", "Other", "YetAnotherStatus"] -> "Approved, Recommended, Other or YetAnotherStatus"
			 * 
			 * @param {array} statuses - an array of strings representing statuses
			 * @returns {string} - a formated string with all statuses
			 */
			function format(statuses){
				if(statuses.length === 1){
					return statuses[0];
				}
				var firstItems = statuses.slice(0, statuses.length - 1);
				var lastItem = statuses[statuses.length - 1];
				return jQuery.sap.formatMessage(resourceBundle.getText("ManageOffers.offerNotEditableOr"), firstItems.join(", "), lastItem);
			}
			
			if (Array.isArray(data) && data.some(isUneditable) ) {
				
				var text = "";
				
				if(data.every(hasBadStatus)){
					var statuses = format(data.map(getOfferStatus).filter(itemAt));
					text = jQuery.sap.formatMessage(resourceBundle.getText("ManageOffers.offerNotEditableStatus"), statuses);
				}else if(data.every(notEditable)){
					text = resourceBundle.getText("ManageOffers.offerNotEditable");
				}else{
					text = resourceBundle.getText("ManageOffers.offerNotEditableGeneric");
				}
				
				Utils.getErrorHandler().showError(text);
				return;
			}
			
			var processedData = this.processOffersMultipleEdit(data);
			var dialog = this.createMultipleEditDialog(processedData);

			var sameMD = hasSameMD(data);

			if (sameMD) {
   				this.addMDDependentSets(dialog, data[0].MasterdataSystem);
   			}

			this.addDataMultipleEdit(dialog, {
				OfferSet: {}
			});
		},

		getSelectedOffers: function () {
	   		return this.offers.getSelectedItems().map(function (item) {
				return item.getBindingContext().getObject();
			});
		},

		getSelectedOffersLength: function () {
			return this.getSelectedOffers().length;
		},

	   	editOfferPressed : function () {
	   		var multipleOffersSelected = function() {
	   			return this.getSelectedOffersLength() > 1;
	   		}.bind(this);

	   		this.oMessageManager.removeAllMessages();
	   		var selectedOffers = this.getSelectedOffers();

	   		if(multipleOffersSelected()) {
	   			this.editMultipleOffers(selectedOffers);
	   		} else {
	   			Utils.navToEditOffer(this.oRouter, selectedOffers[0]);
	   		}
	   	},

	   	createFromVendorFunds : function(){
	   		this.getRouter().navTo("vendorFunds");
	   	},

	   	displayOffer: function(oEvent) {
	   		this.oMessageManager.removeAllMessages();
	   		var oOffer = oEvent.getSource().getBindingContext().getObject();
	   		this.oRouter.navTo("display", {
   				path :  Utils.base64ToHex(oOffer.OfferId)
   			});
	   	},
	   	handleOfferFunctionsDialogSearch: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("ActionName", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},


	   	/**
		 * Triggered when status, transfer or update links from the smart table tool bar is pressed.
		 *
		 * @param {object} oEvent The event object
		 * @returns {void}
		 */
	   	handleOfferFunctionPress: function(oEvent) {
	   		this.oMessageManager.removeAllMessages();
	   		var sArea = oEvent.getSource().data("area");
	   		var aSelectedOffers = this.getSelectedOffers();

	   		if (!this.oSelectDialog) {
	   			this.oSelectDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.OfferFunctionsDialog", this);
	   			this.oSelectDialog.setModel(new JSONModel());
	   			this.oSelectDialog.setContentHeight("30%");
	   		}
	   		
	   		var sTitle = oEvent.getSource().getProperty("text");
	   		this.oSelectDialog.getModel().setData({
	   			Title: sTitle,
   				Items: []
   			});
	   		Models.getOffersActions(aSelectedOffers, sArea).then(function(oData) {
	   			var aCommonAreaActions = this.getCommonAreaActions(oData.data);
	   			this.oSelectDialog.getModel().setData({
	   				Title: sTitle,
	   				Items: aCommonAreaActions
	   			});
	   			var oBinding = this.oSelectDialog.getBinding("items");
				oBinding.filter([]);
	   			this.oSelectDialog.open();
	   			
	   		}.bind(this), Utils.handleErrors);
	   	},
	   	
	   	/**
   		 * Triggered when pressing the collision detection button.
   		 * It opens the collision detection dialog.
   		 *
   		 * @returns {void}
   		 */
   		onCollisionDetection: function() {
   			this.content.setProperty("/CollisionEnabled", false);
   			var oOffer = this.offers.getSelectedItem().getBindingContext().getObject();
   			var oView = this.getView();
	   		Models.getOffer(oOffer).then(function(data){
	   			this.oMessageManager.removeAllMessages();
	   			var payload = data.data;
	   			payload.Terms = payload.Terms.results || [];
	   			this.offerOperations.detectCollision().then(function(dialog) {
	   				this.offerOperations.populateCollisionDetection(dialog, payload, oView).then(function(){
	   	   				this.content.setProperty("/CollisionEnabled", true);  
	   				}.bind(this)); 
	   			}.bind(this));
	   		}.bind(this));
   		},
   		
   		onOfferContent: function() {
   			var oOffer = this.offers.getSelectedItem().getBindingContext().getObject();
   			Utils.toOfferContent(oOffer.OfferId, this.getOwnerComponent().getMetadata().getConfig());
		},

	   	getCommonAreaActions: function(aArrays) {
	   		var iArrayIndex, common, i;
	   		var iPosition = aArrays.length;
	   		var iMinLenght = Infinity;
	   		while (iPosition) {
	   			if(aArrays[--iPosition].length < iMinLenght) {
	   				iMinLenght = aArrays[iPosition].length;
	   				iArrayIndex = iPosition;
	   			}
	   		}
	   		common = aArrays.splice(iArrayIndex, 1)[0];
	   		return common.filter(function(oItem) {
	   			return aArrays.every(function(arr) {
	   				for (i = 0; i < arr.length; i++) {
	   					if (arr[i].Action === oItem.Action) {
	   						return true;
	   					}
	   				}
	   				return false;
	   			});
	   		});
	   	},

	   	/**
	   	 * Triggered when an item is selected from the offer functions dialog.
	   	 *
	   	 * @param {object} oEvent The event object
	   	 * @returns {void}
	   	 */
	   	offerFunctionsConfirmSelectDialog: function(oEvent) {
	   		var aSelectedOffers = this.getSelectedOffers();
	   		var oSelectedAction = oEvent.getParameter("selectedItem").getBindingContext().getObject();
	   		var sMessage = "";
	   		var oBundle = this.i18nModel.getResourceBundle();
	   		var aAvailFunction = this.model.getServiceMetadata().dataServices.schema[0].entityContainer[0].functionImport;
	        var bHasMassOfferTransfer = aAvailFunction.filter(function(fn) { return (fn.name === 'MassOfferTransfer'); });
	   		
	   		Utils.getErrorHandler().showBusy();
	   		// support mass offer transfer only when backend change has applied
			if (bHasMassOfferTransfer.length > 0 && oSelectedAction.Action === '04' && oSelectedAction.Area === 'T') {
	   		   var oServiceCall =  Models.executeMassOfferTransfer(aSelectedOffers);
	   		} else {
	   		   var oServiceCall = Models.getExecuteOffersActions(aSelectedOffers, oSelectedAction.Action, oSelectedAction.Area);
	   		}
	   		oServiceCall.then(
	   			function() {
	   				Utils.getErrorHandler().hideBusy();
	   				if (Utils.getErrorHandler().numOfErrors(this.oMessageManager) > 0) {
	   					sMessage = oBundle.getText("ManageOffers.MassProcess.Error");
   						Utils.getErrorHandler().showError(sMessage);
   					} else {
   						sMessage = oBundle.getText("ManageOffers.MassProcess.Success");
   						Utils.getErrorHandler().showToast(sMessage);
   					}
   					this.model.refresh(true);
	   		}.bind(this), function(e) {
   				Utils.getErrorHandler().hideBusy();
   				Utils.handleErrors(e);
   			});
	   	},

	   	/**
	   	 * Performs table refresh.
	   	 *
		 * @returns {void}
	   	 */
	   	refreshOffersTable: function() {
	   		this.offers.removeSelections();
	   		this.content.setProperty("/DeleteEnabled", false);
	   		this.content.setProperty("/OfferFunctionsEnabled", false);
	   		this.content.setProperty("/EditEnabled", false);
	   		this.content.setProperty("/Editable", false);
	   		this.content.setProperty("/CollisionEnabled", false);
	   	},

	   	onMessagesIndicatorPress: function(oEvent) {
	   		oMessagePopover.openBy(oEvent.getSource());
	   	}
   	});

});