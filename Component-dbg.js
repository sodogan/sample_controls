/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/UIComponent",
	"retail/pmr/promotionaloffers/utils/Models",
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/view/AppState",
	"retail/pmr/promotionaloffers/view/CommunicationProcessor",
	"retail/pmr/promotionaloffers/view/CommunicationProcessorWrapper",
	"retail/pmr/promotionaloffers/view/CommunicationServices",
	"sap/ui/model/json/JSONModel",
	"sap/m/BusyDialog"
], function(UIComponent, Models, Utils, AppState, Processor, Wrapper, Services, JSONModel, BusyDialog) {
	"use strict";

	return UIComponent.extend("retail.pmr.promotionaloffers.Component", {
		metadata: {
			manifest: "json"
		},

		_initComponentModels: function(mModels, mDataSources) {

			// Workaround for older UI5 Versions		
			// ADDING "sap-language" URL PARAMETER
			mModels[""].settings = mModels[""].settings || {};

			mModels[""].settings["metadataUrlParams"] = mModels[""].settings["metadataUrlParams"] || {};
			mModels[""].settings["metadataUrlParams"]["sap-language"] = sap.ui.getCore().getConfiguration().getLanguageTag();

			mModels[""].settings["serviceUrlParams"] = mModels[""].settings["serviceUrlParams"] || {};
			mModels[""].settings["serviceUrlParams"]["sap-language"] = sap.ui.getCore().getConfiguration().getLanguageTag();

			return UIComponent.prototype._initComponentModels.call(this, mModels, mDataSources);
		},

		init: function() {
			//call createContent
			UIComponent.prototype.init.apply(this, arguments);

			var oModel = this.getModel();
			if (!oModel) {
				return;
			}
			oModel.setUseBatch(false);

			oModel.attachMessageChange(jQuery.proxy(Utils.messageChangeEvent, Utils));

			this._router = this.getRouter();

			var hidderModel = new JSONModel({
				Visible: true,
				Version: 1,
				ContentAssignmentEnabled: false
			});

			var actionAllowedModel = new JSONModel({
				ActionAllowed: true
			});

			var resourceBundle = this.getModel("i18n").getResourceBundle();
			Utils.setResourceModel(this.getModel("i18n"));
			
			var loadingDataBusyDialog = new BusyDialog({
				text: resourceBundle.getText("CreateOffer.BusyIndicator.Loading")
			});
			var saveDataBusyDialog = new BusyDialog({
				text: resourceBundle.getText("UpdateOffer.BusyIndicatorUpdateOffer.Loading")
			});

			this.setModel(hidderModel, "UIVisiblity");
			this.setModel(actionAllowedModel, "ActionsAllowed");

			this.appState = new AppState();
			this._router.attachRouteMatched(function(e) {

				var pathName = e.getParameter("name");
				var path = e.getParameter("arguments").path;

				var service = Services.get(pathName, path);
				var view = e.getParameter("view").getController();

				//initialize the base communication processor
				var dataProvider = view.getOfferDataProvider ? view.getOfferDataProvider() : {
					getOfferData: function() {}
				};

				var baseLoader = new Processor(this.appState, service, dataProvider);
				//wrap the comms processor so that it shows a please wait dialog for init and save
				var pleaseWaitLoader = new Wrapper.showPleaseWait(baseLoader, loadingDataBusyDialog, saveDataBusyDialog);
				//wrap the loader again so that it hides the UI while loading.
				//this makes it so that the user does not see a flash of empty content.
				//he just sees a blank screen with the please wait spinner
				//once all data is loaded the ui is made visible
				var uiHiderLoader = new Wrapper.hideUI(pleaseWaitLoader, hidderModel);
				//wraps all server calls with and sets the "AllowAction" flag to false while request is in flight.
				//the flag is set to true regardless of whether or not the action completes or errors
				//this flag can be used to disabled any server action buttons, in order to avoid race conditions.
				var actionAllowedLoader = new Wrapper.allowActions(uiHiderLoader, actionAllowedModel);

				var loader = actionAllowedLoader;
				this.appState.setCommunicationProcessor(loader);
				
				if (pathName === "manage") {
					this.appState.invalidate();
				}

			}, this);

			//initialize the router
			this._router.initialize();

			//store schema version
			var oMetaModel = this.getModel().getMetaModel();
			oMetaModel.loaded().then(function() {
				var sVersion = oMetaModel.getProperty("/dataServices/schema/0/sap:schema-version");
				hidderModel.setProperty("/Version", sVersion);
			});

			this._checkContentIntent(hidderModel);
		},

		getTermStyles: function() {
			var config = this.getMetadata().getConfig();
			return config.termStyles;
		},

		getState: function() {
			return this.appState;
		},

		_checkContentIntent: function(oModel) {
			//Determine if intent for managing offer content is supported
			var oService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			if (oService) {
				var oConfig = this.getMetadata().getConfig();
				oService.isNavigationSupported(
					[{
						target: {
							semanticObject: oConfig.offerSemanticObject,
							action: oConfig.contentAction
						}
					}]
				).done(function(oResult) {
					oModel.setProperty("/ContentAssignmentEnabled", oResult[0].supported);
				});
			}
		}
	});

});