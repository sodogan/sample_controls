/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"retail/pmr/promotionaloffers/utils/Models",
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/utils/OfferOperations",
	"retail/pmr/promotionaloffers/utils/Formatter",
	"sap/ui/model/json/JSONModel",
	"retail/pmr/promotionaloffers/view/CommunicationProcessor",
	"retail/pmr/promotionaloffers/view/CommunicationProcessorWrapper",
	"retail/pmr/promotionaloffers/view/CommunicationServices",
	"sap/ui/core/routing/History",
	"retail/pmr/promotionaloffers/utils/ForecastDialog"
], function (Controller, Models, Utils, OfferOperations, Formatter, JSONModel,
	CommunicationProcessor, Wrapper, CommunicationServices, History, ForecastDialog) {
	"use strict";


	var oErrorMessagePopover = Utils.getErrorHandler().createMessagePopover();
	var hasChangesFinPress  = (function () {
		var changes = false;
		return {
			changes: changes
		};
	}());
	
	function OfferDataProvider(mainController) {
		this.getOfferData = function () {
			if (!mainController) {
				return {};
			}

			var general = mainController.generalController.getOfferData();
			var vendorFunds = mainController.vendorFundsController.getOfferData();
			var terms = mainController.termsController.getOfferData();
			var attributes = mainController.attributesController.getOfferData();
			var versions = mainController.versionsController.getOfferData();
			var payload = {};

			jQuery.extend(payload, general, terms, vendorFunds, attributes, versions);
			payload = mainController.cleanPaylodForSave(payload);
			payload.Financials = [{
				Id: ""
			}];
			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.view.MainPageTabs~extHookOngetOfferData
			 * @param {object} payload The Offer payload
			 * @return {object} The modified payload
			 */
			if (mainController.extHookOngetOfferData) {
				payload = mainController.extHookOngetOfferData(payload);
			}
			return payload;
		};

		this.getOfferWithFinancials = function () {
			if (!mainController) {
				return {};
			}
			var payloadWithFinancials = {};
			var payload = this.getOfferData();
			var financials = mainController.termsController.getFinancials();
			var termsProdWithFinancials = mainController.termsController.getTermsProductsFinancials();
			jQuery.extend(payloadWithFinancials, payload, {
				Financials: financials
			}, termsProdWithFinancials);
			return payloadWithFinancials;
		};
	}

	function shouldExitDirectly(hasChanges, editable) {
		if (editable && hasChanges) {
			return false;
		}
		return true;
	}

	function checkForError(sMsg) {
		var oErrorHandler = Utils.getErrorHandler();
		if (oErrorHandler.numOfErrors() > 0) {
			oErrorHandler.showError(sMsg);
		}
	}

	function createCancelDialog(options) {
		var loader = options.loader;
		var offerData = loader.getOfferData();
		options.controller.isForSave = true;
		options.controller.removeFinancial = true;
		options.state = "Warning";
		options.controller.isForSave = false;
		var hasChanges = loader.hasChanges();
		if (hasChangesFinPress.changes) {
			hasChanges = true;
		}
		if (offerData && shouldExitDirectly(hasChanges, !offerData.Readonly)) {
			return Promise.resolve();
		}

		function ok(resolve) {
			resolve();
		}

		function cancel(resolve, reject) {
			options.controller.cleanIdsFromTerms = true;
			reject();
		}

		return Utils.createDialogUtil(jQuery.extend(options, {
			onOk: ok,
			onCancel: cancel
		}));
	}

	function forecastDialog(options) {

		function ok(resolve) {
			resolve();
		}

		function cancel(resolve, reject) {
			reject();
		}

		return Utils.createDialogUtil(jQuery.extend(options, {
			onOk: ok,
			onCancel: cancel
		}));
	}

	function controllerById(view, id) {
		return view.byId(id).getController();
	}

	var MainPageTabsController = Controller.extend("retail.pmr.promotionaloffers.view.MainPageTabs", {
		extHookOndataLoaded: null,
		extHookOngetOfferData: null,
		extHookOnvalidate: null,
		constructor: function () {
			this.dataModel = new JSONModel();
			this.featuresAvailable = new JSONModel();
			this.contentModel = new JSONModel({
				CollisionEnabled: false
			});
		},

		routeMatched: function (e) {
			if (!this.state) {
				return;
			}
			var history = History.getInstance();
			var lastHash = history.aHistory[history.aHistory.length - 1];
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.masterDataSystemChange, this);
			this.pathName = e.getParameter("name");
			this.state.validate();
			this.cleanIdsFromTerms = false;
			if (["create", "edit", "copy", "vendorFundsCreate", "display"].indexOf(this.pathName) === -1) {
				return;
			}
			if (lastHash.indexOf("productGroup") !== -1) {
				this.generalController.validateForm();
				this.termsController.validateForm();
				this.attributesController.validateForm();
				return;
			}
			this.isBackFromVersions = false;

			if (this.pathName === "create" || this.pathName === "vendorFundsCreate") {
				this.resetViewsContent();
				this.state.invalidate();
				this.getEventBus().subscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.masterDataSystemChange, this);
				var objectPage = this.getView().byId("ObjectPageLayout");
				var firstSection = objectPage.getSections()[0];
				this.getView().byId("ObjectPageLayout").scrollToSection(firstSection.getId());
				//set focus to meet accessibility requirement
				if (this.pathName === "create") {
					var oFocusField = this.generalController.getView().byId("generalName");
					oFocusField.addEventDelegate({
						onAfterRendering: function () {
							oFocusField.focus();
						}
					});
				}
			} else {
				this.getView().byId("versions").setVisible(true);
			}

			if (["create", "edit", "copy", "vendorFundsCreate"].indexOf(this.pathName) === -1) {
				this.toggleCollisionBtnListener(false);
			} else {
				this.toggleCollisionBtnListener(true);
			}

			var previousHash = history.getPreviousHash() || "";
			// In case we have left create mode with Home button before, we have to clear the previous hash
			if (this.pathName === "edit" && previousHash === "create") {
				previousHash = "";
			}
			var hideLoadingPage = false;

			if (this.pathName === "display" ||
				this.pathName === "edit" ||
				this.pathName === "create" ||
				this.pathName === "vendorFundsCreate" ||
				this.pathName === "copy" ||
				this.pathName === "locationGroups") {
				hideLoadingPage = true;
			}

			if (previousHash.indexOf("version") < 0 && previousHash.indexOf("locationGroups") < 0) {
				if (this.pathName === "edit" || this.pathName === "copy" || this.pathName === "display") {
					this.state.invalidate();
				}
			} else {
				this.isBackFromVersions = true;
				hideLoadingPage = previousHash.indexOf("locationGroups") >= 0;
			}
			//mark the store as valid if we're editing a newly saved offer or copy of an offer
			var isCreationPath = previousHash.indexOf("create") > -1 || previousHash.indexOf("copy") > -1 || previousHash.indexOf(
				"vendor-funds") > -1;
			if (isCreationPath && this.pathName === "edit") {
				this.state.storeValid();
				this.state.validate();
			}

			this.startLoading(this.state, hideLoadingPage);
			this.state.restoreValid();

		},
		
		toggleCollisionBtnListener: function(sub){
			if(sub){
				if(!this.toggleCollisionBtnListenerOn){
					this.getEventBus().subscribe("retail.pmr.promotionaloffers", "toggleCollisionBtn", this.toggleCollisionBtn, this);
					this.toggleCollisionBtnListenerOn = true;
				}
			}
			else{
				this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "toggleCollisionBtn", this.toggleCollisionBtn, this);
				this.toggleCollisionBtnListenerOn = false;
			}
		},

		onInit: function () {
			this.generalController = controllerById(this, "generalView");
			this.termsController = controllerById(this, "termsView");
			this.vendorFundsController = controllerById(this, "vendorFundsView");
			this.attributesController = controllerById(this, "attributesView");
			this.versionsController = controllerById(this, "versionsView");
			var that = this;
			this.versionsController.setSaveCallback(function () {
				Utils.manageVersionsSaveDialog(that.getView()).then(function () {
					that.onSave(null, true).then(function (data) {
						if (data) {
							that.getEventBus().publish("retail.pmr.promotionaloffers", "launchVersionPage", {
								oData: that.state.getOfferData()
							});
						}
					});
				}, jQuery.noop);
			});

			this.termsController.setGeneralDataModel({
				getDataModel: function () {
					return this.generalController.dataModel;
				}.bind(this)
			});

			this.oMessageManager = Utils.getMessageManager();
			oErrorMessagePopover.setModel(this.oMessageManager.getMessageModel());
			this.getView().setModel(this.dataModel);
			this.getView().setModel(this.featuresAvailable, "featuresAvailable");
			this.getView().setModel(this.contentModel, "Content");
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "validateOfferForVersion", this.validateOfferForVersion, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "resetTermsTab", this.resetTermsTab, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "setLocationSelection", this.setLocationSelection, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "onVersionDataChange", this.versionDataChange, this);

			this.state = this.getOwnerComponent().getState();
			this.toggleCollisionBtnListenerOn = false;

			this.getRouter().attachRouteMatched(this.routeMatched, this);

			Utils.addMasterdataSystemButton(this.getEventBus());
			this.aFinHeaderFields = ["marginField", "unitField", "salesField", "profitField", "fundField", "forecastField"].map(function (x) {
				return this.getView().byId(x);
			}, this);

			this.aForecastHeaderFields = ["forecastField"].map(function (x) {
				return this.getView().byId(x);
			}, this);

			this.offerOperations = new OfferOperations(this.state);
		},
		resetTermsTab: function () {
			this.termsController.resetOfferData();
			var selectedStyle = this.termsController.getSelectedTermStyle();
			var isPacakgeOffer = this.generalController.isPackageOffer();
			this.versionsController.resetTermsTab(selectedStyle, isPacakgeOffer);
		},
		onExit: function () {
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.masterDataSystemChange, this);
			this.toggleCollisionBtnListener(false);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "validateOfferForVersion", this.validateOfferForVersion, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "resetTermsTab", this.resetTermsTab, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "setLocationSelection", this.setLocationSelection, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onVersionDataChange", this.versionDataChange, this);
		},

		cleanPaylodForSave: function (data) {
			var payload = jQuery.extend(true, {}, data);
			if (!this.isForSave) {
				return payload;
			}
			if (payload.Versions) {
				for (var i = 0; i < payload.Versions.length; i++) {
					var version = payload.Versions[i];
					delete version.LocalNodes;
					delete version.locationPath;
					if (this.removeFinancial) {
						Utils.cleanFinancialsForVersion(version);
					} else {
						Utils.cleanFinancialsForVersion(version, true);
					}
				}
			}
			if (this.removeFinancial) {
				Utils.cleanFinancialsForVersion(payload);
				delete payload.PurchasingGroupName;
			} else {
				Utils.cleanFinancialsForVersion(payload, true);
			}
			this.removeFinancial = false;
			if (this.cleanIdsFromTerms) {
				this.removeAfterFinancialCalc(payload);
				this.cleanIdsFromTerms = false;
			}
			if (!payload.PackageOffer) {
				delete payload.PackageValue;
			}
			this.storeLocationHierarchy = payload.LocationHierarchy;
			//delete payload.LocationHierarchy;
			payload.LocationHierarchy = [{
				Locations: [{}]
			}];

			this.isForSave = false;

			return payload;
		},

		showForecast: function (oEvent) {
			var sId = this.getView().getModel().getProperty("/OfferId");
			var oKey = {
				OfferId: sId
			};
			ForecastDialog.show(ForecastDialog.Level.Offer, oKey, Models.getServiceModel(), Utils.getResourceModel());
		},

		/**
		 * Creates and opens the confirm dialog when pressing cancel.
		 * 
		 * @returns {void}
		 */
		openCancelDialog: function () {
			var cancelDialogOptions = {
				loader: this.state,
				controller: this,
				view: this.getView(),
				title: "{i18n>CreateOffer.OfferCancelDialogTitle}",
				message: "{i18n>CreateOffer.OfferCancelDialogDescription}",
				btnOk: "{i18n>CreateOffer.CreateOfferDialog.Accept}",
				btnCancel: "{i18n>CreateOffer.CreateOfferDialog.Reject}"
			};
			var that = this;
			return createCancelDialog(cancelDialogOptions, this.getView().getModel("i18n").getResourceBundle()).then(function () {
				var lastHash = History.getInstance().getPreviousHash();
				if (lastHash) {
					window.history.go(-1);
				} else {
					that.getRouter().navTo("manage", true);
				}
				that.oMessageManager.removeAllMessages();
				that.state.storeLocationSubgroups([]);
			}, Utils.identity);
		},
		/**
		 * Triggered when pressing the collision detection button.
		 * It opens the collision detection dialog.
		 *
		 * @returns {void}
		 */
		onCollisionDetection: function () {

			var payload = jQuery.extend(true, {}, this.state.getSavePayload());
			this.isForSave = true;
			this.removeFinancial = true;
			payload = this.cleanPaylodForSave(payload);

			this.oMessageManager.removeAllMessages();
			Utils.getErrorHandler().showBusy();

			var oView = this.getView();
			var sError = this.getView().getModel("i18n").getResourceBundle().getText("CreateOffer.ErrorMessage.Collision");

			this.offerOperations.detectCollision().then(function (dialog) {
				this.offerOperations.populateCollisionDetection(dialog, payload, oView).then(function () {
					Utils.getErrorHandler().hideBusy();
					checkForError(sError);
					this.contentModel.setProperty("/CollisionEnabled", true);
				}.bind(this));
			}.bind(this));
		},

		onOfferContent: function () {
			var sId = this.state.getOfferData().OfferId;
			Utils.toOfferContent(sId, this.getOwnerComponent().getMetadata().getConfig());
		},

		onSave: function (oEvent, bUnloadData) {

			var isVersionValidation = true;
			if (!this.verifyValidation("{i18n>CreateOffer.SaveOffer.Title}", isVersionValidation)) {
				return;
			}

			this.oMessageManager.removeAllMessages();
			this.isForSave = true;
			this.removeFinancial = true;

			var oBundle = this.getView().getModel("i18n").getResourceBundle();

			var that = this;
			return this.state.save().then(function (oResponse) {
				Utils.getErrorHandler().showToast(oBundle.getText("CreateOffer.ToastMessage.SaveCompleted"));
				var navigate = false;
				var data = oResponse.data;
				if (!bUnloadData) {
					that.startLoading(that.state, true).then(function () {
						that.isForSave = false;
						that.state.processor.storeSnapshot(that.state.processor.createSavePayload());
					});
				} else {
					that.dataRoute = data;
				}

				if (Utils.isReadOnly({
						Status: data.Status,
						UIState: data.UIState
					})) {
					that.getRouter().navTo("display", {
						path: Utils.base64ToHex(oResponse.data.OfferId)
					}, true);
					navigate = true;
				} else if (!that.dataModel.getProperty("/ExtOfferId")) {
					that.state.storeBack(true);
					Utils.navToEditOffer(that.getRouter(), that.state.getOfferData(), true);
					navigate = true;
				}
				return {
					data: data,
					navigate: navigate
				};
			}, function (e) {
				if (e.responseText.indexOf("Marketing area ID") >= 0) {
					that.generalController.resetMarketingArea();
				}
				Utils.getErrorHandler().showError(oBundle.getText("CreateOffer.ErrorMessage.Save"));
			}).then(null, function (e) {
				jQuery.sap.log.error(e);
			});
		},

		verifyValidation: function (title, isVersionValidation) {
			var tabs = [];
			var i18nBundle = this.getView().getModel("i18n").getResourceBundle();
			if (this.generalController.validateForm()) {
				tabs.push(i18nBundle.getText("CreateOffer.Properties.Title"));
			}
			if (this.termsController.validateForm()) {
				tabs.push(i18nBundle.getText("CreateOffer.Terms.Title"));
			}
			if (this.attributesController.validateForm()) {
				tabs.push(i18nBundle.getText("CreateOffer.Attributes.Title"));
			}
			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.view.MainPageTabs~extHookOnvalidate 
			 * @return {array} Array with title sections that contain errors
			 */
			if (this.extHookOnvalidate) {
				tabs = tabs.concat(this.extHookOnvalidate());
			}

			var errors = isVersionValidation ? Utils.getMessageManager().getMessageModel().getData().filter(function (error) {
				return error.getType() === "Error" && !error.persistent;
			}) : [];

			if (tabs.length || errors.length > 0) {
				var sMsg = tabs.length ? i18nBundle.getText("CreateOffer.SaveOffer.Validate", tabs.join(", ")) : i18nBundle.getText(
					"Offer.Save.UserAction.Needed");
				Utils.getErrorHandler().showError(sMsg);
				return false;
			}

			return true;
		},

		onCancel: function () {
			this.state.storeBack(true);
			this.openCancelDialog().then(function () {
				this.state.storeBack(false);
			}.bind(this));
		},

		onNavButtonPress: function () {
			this.openCancelDialog();
		},

		onMessagesIndicatorPress: function (oEvent) {
			oErrorMessagePopover.openBy(oEvent.getSource());
		},

		dialogOptions: function (loader) {
			return {
				view: this.getView(),
				loader: loader,
				title: "{i18n>EditOffer.EditOfferDialog.Title}",
				message: "{i18n>EditOffer.EditOfferDialog.Message}",
				btnOk: "{i18n>CreateOffer.CreateOfferDialog.Accept}",
				btnCancel: "{i18n>CreateOffer.CreateOfferDialog.Reject}"
			};
		},
		masterDataSystemChange: function (channel, event, context) {
			var that = this;
			var system = context.MasterdataSystemId;
			var oldSystem = this.dataModel.getProperty("/MasterdataSystem");
			var shouldPromptUser = function shouldPromptUser() {
				var i, iLen;
				var offer = that.state.getSavePayload();
				var generalFields = ["LocationNodeId", "PromotionType", "LeadingCategory", "PurchasingGroup"];
				for (i = 0, iLen = generalFields.length; i < iLen; i++) {
					if (offer.hasOwnProperty(generalFields[i])) {
						return true;
					}
				}
				var terms = offer.Terms;
				for (i = 0, iLen = terms.length; i < iLen; i++) {
					if (terms[i].ProductId) {
						return true;
					}
				}
				return false;
			};

			var promptUser = function promptUser() {
				return Utils.promptUserForMasterDataSystemChange(system, oldSystem, that.getView().getModel("i18n"));
			};

			if (shouldPromptUser()) {
				return promptUser().then(function () {
					that.generalController.setSystem(system);
					Models.setMasterDataSystemPersonalization(system);
					that.state.offerData.MasterdataSystem = system;
				}, function () {
					that.generalController.resetSystem(oldSystem);
				});
			} else {
				setTimeout(function () {
					that.generalController.setSystem(system);
					Models.setMasterDataSystemPersonalization(system);
					that.state.offerData.MasterdataSystem = system;
				});

			}

		},

		toggleCollisionBtn: function () {
			var oGeneralData = this.generalController.getOfferData();
			var oTermsData = this.termsController.getOfferData();

			var bEnableBtn = ["LocationNodeId", "StartOfOffer", "EndOfOffer"].every(function (sProperty) {
				return !!oGeneralData[sProperty];
			}) && oTermsData.Terms.some(function (oItem) {
				return oItem.ProductId || oItem.HierarchyNodeId || oItem.DimensionType === "20";
			});

			this.contentModel.setProperty("/CollisionEnabled", bEnableBtn);
		},
		versionDataChange: function (channel, event, context) {
			this.keepSnapshot = true;
			//this.loadDataComingFromVersion(context);
		},

		loadDataComingFromVersion: function (offerData) {
			var offerWithVersions = {};
			jQuery.extend(true, offerWithVersions, this.state.getOfferData(), offerData);
			offerWithVersions.Versions = offerData.Versions;
			offerWithVersions.LocalNodes = offerData.LocalNodes;
			this.isBackFromVersions = true;
			this.setOfferData(offerWithVersions, this.state);
		},

		startLoading: function (state, hideLoadingPage) {

			return state.load(function () {
				this.state.storeBack(false);
				this.dataLoaded(state, hideLoadingPage);
				this.toggleCollisionBtn();
			}.bind(this)).then(null, function (error) {
				jQuery.sap.log.error(error.stack);
				var navButtonsEnabled = this.contentModel.getProperty("/NavButtonsEnabled");
				this.contentModel.setProperty("/ShowFooter", navButtonsEnabled || Utils.errorMessagesExists());
			}.bind(this));
		},

		dataLoaded: function (loader, hideLoadingPage) {
			var offerDataFromLoad = loader.getOfferData();
			if (this.keepSnapshot) {
				// comes from versions
				this.state.store(offerDataFromLoad, !!offerDataFromLoad.Readonly);
			} else if (this.pathName === "display") {
				this.state.store(offerDataFromLoad, {
					Readonly: true
				});
			} else {
				this.state.store(offerDataFromLoad, {
					Readonly: false
				});
			}

			var offerData = loader.getOfferData();
			offerData = this.cleanPaylodForSave(offerData);
			this.setOfferData(offerData, loader, hideLoadingPage);
		},

		onLoadingPage: function (isLoading, isForecast, hideLoadingPage) {
			if (hideLoadingPage) {
				return;
			}

			var oErrorHandler = Utils.getErrorHandler();
			if (isLoading) {
				if (isForecast) {
					var dialogTitle = Utils.getResourceModel().getResourceBundle().getText("CreateOffer.LoadingForecast.Message");
					oErrorHandler.showBusy(dialogTitle);
				} else {
					oErrorHandler.showBusy();
				}
			} else {
				if (isForecast) {
					oErrorHandler.hideBusy();
				} else {
					jQuery.sap.delayedCall(300, this, function () {
						oErrorHandler.hideBusy();
					});
				}
			}
		},

		setOfferData: function (offerData, loader, hideLoadingPage) {
			this.onLoadingPage(true, false, hideLoadingPage);
			var staticData = loader.getStaticData();
			this.staticData = staticData;

			if (offerData.MasterdataSystem && staticData.MasterDataSystemSet.length === 0) {
				Utils.criticalError(Utils.getI18NModel(), "Missing Masterdata System",
					"Check that user can get a list of masterdata systems from backend.",
					"Call '/MasterdataSystems' and check it has values");
			}

			this.contentModel.setData({
				Editable: !offerData.Readonly && !Utils.isEditableHeader({
					Status: offerData.Status,
					UIState: offerData.UIState
				}),
				CollisionEnabled: false,
				NavButtonsEnabled: !offerData.Readonly,
				ShowFooter: !offerData.Readonly || Utils.errorMessagesExists()
			});

			this.dataModel.setData(offerData);
			var result = Utils.setupFeatures(staticData.FeaturesAvailable);
			this.featuresAvailable.setData(result);

			this.featuresAvailable.refresh(true);
			var featuresAvailable = this.featuresAvailable.getData();

			this.generalController.setOfferData(offerData, staticData, featuresAvailable);
			this.generalController.setDataProvider(loader);

			this.termsController.setRouter(this.getRouter());
			this.termsController.setOfferData(offerData, staticData);
			this.attributesController.setOfferData(offerData, staticData);

			this.vendorFundsController.setDataProvider(loader);
			this.vendorFundsController.setOfferData(offerData, staticData);

			this.versionsController.setDataProvider(loader);
			this.versionsController.setOfferData(offerData);
			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.view.MainPageTabs~extHookOndataLoaded 
			 * @param {object} loader PleaseWaitCommunicationWrapper
			 * @param {object} offerData New Offer Data
			 * @return {void}
			 */
			if (this.extHookOndataLoaded) {
				this.extHookOndataLoaded(loader, offerData);
			}
			this.onLoadingPage(false, false, hideLoadingPage);
			var statusObj = {
				Status: offerData.Status,
				UIState: offerData.UIState
			};
			if ((!offerData.Editable || Utils.isStatusApprovedSaved(!this.isBackFromVersions, statusObj)) && this.pathName === "edit") {
				var messageText = "{i18n>ManageOffers.offerNotEditable}";
				if (Utils.isStatusApprovedSaved(!this.isBackFromVersions, statusObj)) {
					messageText = "{i18n>ManageOffers.offerNotEditableIsApproved}";
				}
				var that = this;
				Utils.createDialogUtil({
					title: "{i18n>ManageOffers.OfferFunctionsErrorDialog.Title}",
					btnOk: "{i18n>Offer.OK}",
					message: messageText,
					state: "Error",
					view: this.getView(),
					onOk: function (resolve) {
						resolve();
					}
				}).then(function () {
					that.getRouter().navTo("display", {
						path: Utils.base64ToHex(offerData.OfferId || offerData.RefOfferId)
					}, true);
				});
			}

			if (hideLoadingPage && this.keepSnapshot) {
				this.keepSnapshot = false;
			}
			if (this.pathName === "edit") {
				this.state.createSnapshot();
			}
		},

		getIndexOfTerm: function (termId, terms) {
			var index = -1;
			if (terms && terms.length > 0) {
				for (var i = 0; i < terms.length; i++) {
					if (terms.TermId && terms.TermId === termId) {
						index = i;
					}
				}
			}
			return index;
		},

		updateSnapshotTermProducts: function (snapshot, oldSnapshot) {
			var that = this;
			for (var key in snapshot) {
				if (key !== "Terms") {
					snapshot[key] = oldSnapshot[key];
				} else if (key === "Terms") {
					var newTerms = snapshot[key];
					var oldTerms = oldSnapshot[key];
					if (oldTerms && newTerms && oldTerms.length !== newTerms.length) {
						continue;
					}
					(newTerms || []).forEach(function (term) {
						var indexOldTerm = that.getIndexOfTerm(term.TermId, oldTerms);
						if (indexOldTerm !== -1) {
							var oldTerm = oldTerms[indexOldTerm];
							for (var keyInTerm in term) {
								if (keyInTerm !== "TermProducts") {
									term[keyInTerm] = oldTerm[keyInTerm];
								}
							}
						}
					});
				}
			}
		},

		removeAfterFinancialCalc: function (payload) {
			if (payload) {
				(payload.Terms || []).forEach(function (term) {
					delete term.OfferId;
					delete term.TermId;
				});
			}
		},

		getEventBus: function () {
			return sap.ui.getCore().getEventBus();
		},
		getRouter: function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},
		resetViewsContent: function () {
			this.generalController.resetOfferData();
			this.vendorFundsController.resetView();
			this.versionsController.resetData();
			this.attributesController.resetAttributes();
			this.featuresAvailable.setData({});
			this.storeLocationHierarchy = null;
		},

		setServiceErrors: function (aMessages) {
			var aNoTargetMessages = aMessages.filter(function (oItem) {
				if (oItem.type === "Info") {
					oItem.type = "Information";
				}
				return !oItem.target;
			});
			var aGeneralMessages = aMessages.filter(function (oItem) {
				return oItem.target && oItem.target.indexOf("OfferTerm") === -1 && oItem.target.indexOf("Attributes") === -1;
			});
			var aTermsMessages = aMessages.filter(function (oItem) {
				return oItem.target && oItem.target.indexOf("OfferTerm") >= 0;
			});
			var aAttributesMessages = aMessages.filter(function (oItem) {
				return oItem.target && oItem.target.indexOf("Attributes") >= 0;
			});
			this.generalController.processServerErrors(aGeneralMessages);
			this.termsController.processServerErrors(aTermsMessages);
			this.attributesController.processServerErrors(aAttributesMessages);
			this.setErrorMessages(aNoTargetMessages);
			this.oMessageManager.getMessageModel().refresh();
		},

		setErrorMessages: function (aMessages) {
			var oEmptyModel = new JSONModel();
			var aMappedMessages = aMessages.map(function (oItem) {
				oItem.processor = oEmptyModel;
				if (oItem.type === "Info") {
					oItem.type = "Information";
				}
				return new sap.ui.core.message.Message(oItem);
			});
			this.oMessageManager.addMessages(aMappedMessages);
		},

		handleCalcFinancialsPress: function () {
			//find out if any changes has been made immediately prior to structural change
			hasChangesFinPress.changes = this.state.hasChanges();

			if (!this.verifyValidation("{i18n>CreateOffer.SaveOffer.Title}", false)) {
				return;
			}

			var sError = this.getView().getModel("i18n").getResourceBundle().getText("CreateOffer.ErrorMessage.Calculate");
			var payload = jQuery.extend(true, {}, this.state.getSavePayload());

			this.isForSave = true;
			this.removeFinancial = true;
			payload = this.cleanPaylodForSave(payload);
			this.oMessageManager.removeAllMessages();

			this.offerOperations.calculateFinancials(this.aFinHeaderFields, payload).then(function (resultData) {
				checkForError(sError);
				if (resultData) {
					if (!this.dataModel.getProperty("/ExtOfferId")) {
						resultData.OfferId = "";
					}
					resultData.ChangedOn = this.dataModel.getProperty("/ChangedOn");
					this.dataModel.setData(this.restoreLocationAfterForecast(resultData));
					//	this.termsController.setOfferData(resultData);
					(resultData.Versions || []).forEach(function (version) {
						if (!version.ExtOfferId) {
							version.OfferId = "";
						}
					});
					/**    
				 Callback redirected to MainPageTabs.controller.setOfferData on customer request
			 */
					//	this.generalController.setOfferData(resultData, this.staticData, this.featuresAvailable.getData());
					//	this.versionsController.setOfferData(resultData);
					this.setOfferData(resultData, this.state);
				}
			}.bind(this));
		},

		onForecastPress: function () {

			var oBundle = this.getView().getModel("i18n").getResourceBundle();

			var forecastDialogOptions = {
				loader: this.state,
				view: this.getView(),
				title: "{i18n>CreateOffer.ForecastTitle}",
				message: "{i18n>CreateOffer.OfferForecastDialogDescription}",
				state: "Warning",
				btnOk: "{i18n>CreateOffer.CreateOfferDialog.Accept}",
				btnCancel: "{i18n>CreateOffer.CreateOfferDialog.Reject}"

			};

			var fnError = function (e) {
				this.onLoadingPage(false);
				this.offerOperations.setHeaderFieldsBusyState(false, this.aForecastHeaderFields);
				Utils.identity(e);
			}.bind(this);

			forecastDialog(forecastDialogOptions).then(function () {
				var isVersionValidation = true;
				if (!this.verifyValidation("{i18n>CreateOffer.SaveOffer.Title}", isVersionValidation)) {
					return;
				}
				this.isForSave = true;
				this.removeFinancial = true;
				this.oMessageManager.removeAllMessages();
				this.onLoadingPage(true, true);
				this.offerOperations.getForecast(this.aForecastHeaderFields).then(function (resultData) {
					checkForError(oBundle.getText("CreateOffer.ErrorMessage.Forecast"));
					if (resultData) {
						this.state.store(this.restoreLocationAfterForecast(resultData));
						this.state.storeBack(true);
						this.startLoading(this.state, true);
						if (!this.dataModel.getProperty("/ExtOfferId") || this.pathName !== "edit") {
							this.state.storeBack(true);
							Utils.navToEditOffer(this.getRouter(), this.state.getOfferData(), true);
						}
					}
					this.onLoadingPage(false, true);
				}.bind(this));
			}.bind(this), fnError);
		},

		setLocationSelection: function (channel, event, context) {
			if (context.hierarchy) {
				this.selectedLocationHierarchy = Utils.buildLocationHierarchyFromVH(context.hierarchy);
			}
		},

		restoreLocationAfterForecast: function (result) {
			if (!result.LocationHierarchy || (result.LocationHierarchy && result.LocationHierarchy.length < 1) || (result.LocationHierarchy &&
					result.LocationHierarchy.length > 0 && !result.LocationHierarchy[0].Cardinality && result.LocationHierarchy[0].Locations &&
					result.LocationHierarchy[0].Locations.length < 1)) {
				var locationHierarchy = this.selectedLocationHierarchy;
				if (this.storeLocationHierarchy && this.storeLocationHierarchy.length > 0 && this.storeLocationHierarchy[0].Cardinality) {
					locationHierarchy = this.storeLocationHierarchy;
				}
				result.LocationHierarchy = locationHierarchy;
			}
			return result;
		},

		/**
		 * Fired when pressing status, transfer or update button on offer display.
		 *
		 * @param {object} oEvent The event object
		 * @returns {void}
		 */
		onOfferFunctionPress: function (oEvent) {
			this.oMessageManager.removeAllMessages();
			var sArea = oEvent.getSource().data("area");
			var oOfferData = this.state.getOfferData();

			if (!this.oSelectDialog) {
				this.oSelectDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.OfferFunctionsDialog", this);
				this.oSelectDialog.setModel(new JSONModel());
				this.oSelectDialog.setContentHeight("30%");
				this.getView().addDependent(this.oSelectDialog);
			}

			var sTitle = oEvent.getSource().getProperty("text");
			this.oSelectDialog.getModel().setData({
				Title: sTitle,
				Items: []
			});

			Models.getOffersActions([oOfferData], sArea).then(function (oData) {
				this.oSelectDialog.getModel().setData({
					Title: sTitle,
					Items: oData.data[0]
				});
				this.oSelectDialog.open();
			}.bind(this), Utils.handleErrors);
		},

		handleOfferFunctionsDialogSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("ActionName", sap.ui.model.FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter([oFilter]);
		},

		/**
		 * Triggered when an item is selected from the offer functions dialog.
		 *
		 * @param {object} oEvent The event object
		 * @returns {void}
		 */
		offerFunctionsConfirmSelectDialog: function (oEvent) {
			var oErrorHandler = Utils.getErrorHandler();
			var oBundle = this.getView().getModel("i18n").getResourceBundle();

			var oOfferData = this.state.getOfferData();
			var oSelectedAction = oEvent.getParameter("selectedItem").getBindingContext().getObject();
			var navButtonsEnabled = this.contentModel.getProperty("/NavButtonsEnabled");

			var allErrors = function (e) {
				oErrorHandler.hideBusy();
				this.contentModel.setProperty("/ShowFooter", navButtonsEnabled || Utils.errorMessagesExists());
				Utils.handleErrors(e);
			}.bind(this);

			oErrorHandler.showBusy();
			Models.getExecuteOffersActions([oOfferData], oSelectedAction.Action, oSelectedAction.Area).then(function () {
				oErrorHandler.hideBusy();

				// Show error message in case of error
				if (oErrorHandler.numOfErrors() > 0) {
					oErrorHandler.showError(oBundle.getText("CreateOffer.ErrorMessage.Function"));
					this.contentModel.setProperty("/ShowFooter", navButtonsEnabled || Utils.errorMessagesExists());
					return;
				}

				var sOfferId = Utils.base64ToHex(this.dataModel.getProperty("/OfferId"));
				Models.updateOffer("", "/Offers(binary'" + sOfferId + "')").then(function (result) {

					//Update status related fields
					if (oSelectedAction.Area === "S") {
						var oStatusObj = Utils.getStatusForStore(result.data);
						if (oStatusObj.hasOwnProperty("UIState")) {
							var iUIState = Utils.get(result, ["data", "UIState"]);
							this.dataModel.setProperty("/UIState", iUIState);
						}
						this.dataModel.setProperty("/Status", oSelectedAction.Status);
						this.dataModel.setProperty("/StatusName", oSelectedAction.StatusName);
						this.state.store(this.state.getOfferData(), {
								StatusName: oSelectedAction.StatusName,
								ChangedOn: result.data.ChangedOn,
								ChangedBy: result.data.ChangedBy,
								ChangedByName: result.data.ChangedByName
							},
							oStatusObj);
					}

					//Update transfer related fields
					if (oSelectedAction.Area === "T") {
						this.dataModel.setProperty("/TransferStatusDesc", result.data.TransferStatusDesc);
						this.dataModel.setProperty("/TransferredOn", result.data.TransferredOn);
						this.dataModel.setProperty("/ERPPromotionId", result.data.ERPPromotionId);
						this.state.store(this.state.getOfferData(), {
							TransferStatusDesc: result.data.TransferStatusDesc,
							TransferredOn: result.data.TransferredOn,
							ERPPromotionId: result.data.ERPPromotionId
						});
					}

					this.startLoading(this.state, true);
					this.onLoadingPage(false, true);

				}.bind(this), allErrors);

				Models.getServiceModel().refresh(true);
				this.contentModel.setProperty("/ShowFooter", navButtonsEnabled || Utils.errorMessagesExists());
			}.bind(this), allErrors);
		},

		/**
		 * Fired when pressing delete button on offer display.
		 *
		 * @returns {void}
		 */
		onDeleteOfferPress: function () {

			Utils.openDeleteConfirmDiaog(true).then(function () {

				var oOfferData = this.state.getOfferData();
				var sOfferId = Utils.base64ToHex(oOfferData.OfferId);

				var oErrorHandler = Utils.getErrorHandler();
				oErrorHandler.showBusy();

				Models.deleteOffers([sOfferId]).then(
					function (oData) {
						oErrorHandler.hideBusy();
						if (oErrorHandler.numOfErrors() > 0) {
							var oMsg = Utils.getFirstMessage();
							this.oMessageManager.removeAllMessages();
							oErrorHandler.showError(oMsg.message);
						} else {
							this.getRouter().navTo("manage");
						}
					}.bind(this),
					function (oError) {
						oErrorHandler.hideBusy();
						Utils.handleErrors(oError);
					}
				);
			}.bind(this));
		},

		/**
		 * Fired when pressing edit button on offer display.
		 *
		 * @returns {void}
		 */
		onEditOfferPress: function () {
			var oOfferData = this.state.getOfferData();
			Utils.navToEditOffer(this.getRouter(), oOfferData);
		},

		/**
		 * Fired when pressing copy button on offer display.
		 *
		 * @returns {void}
		 */
		onCopyOfferPress: function () {
			this.oMessageManager.removeAllMessages();
			var oOfferData = this.state.getOfferData();
			this.parentOfferData = oOfferData;
			Utils.navTocopyOffer(this.getRouter(), oOfferData);
		},

		canBeEdited: function (editable, uiState, status) {
			return editable === false && !Utils.isReadOnly({
				Status: status,
				UIState: uiState
			});
		},

		validateOfferForVersion: function (channel, event, context) {
			var isVersionValidation = false;
			if (!this.verifyValidation("{i18n>ManageVersions.ManageVersionsButton}", isVersionValidation)) {
				return;
			}
			this.getEventBus().publish("retail.pmr.promotionaloffers", "launchVersionPage");

		},
		getOfferDataProvider: function () {
			return new OfferDataProvider(this);
		},

		routeForOfferContent: function (data) {
			var sId = this.dataRoute.OfferId;
			var config = this.getOwnerComponent().getMetadata().getConfig();
			Utils.toOfferContent(sId, config);
		},

		onOfferContentSave: function () {
			var view = this.getView();
			Utils.offerContentSaveDialog(view).then(function () {
				var config = this.getOwnerComponent().getMetadata().getConfig();

				this.getRouter().detachRouteMatched(this.routeMatched, this, this);
				this.getRouter().attachRouteMatched(this.routeForOfferContent, this);

				this.onSave(null, true).then(function (result) {
					if (result && result.data && !result.navigate) {
						var sId = this.dataRoute.OfferId;
						Utils.toOfferContent(sId, config);
					}
					this.getRouter().detachRouteMatched(this.routeForOfferContent, this, this);
					this.getRouter().attachRouteMatched(this.routeMatched, this);
				}.bind(this));
			}.bind(this), function () {
				this.getRouter().detachRouteMatched(this.routeForOfferContent, this);
				this.getRouter().attachRouteMatched(this.routeMatched, this);
			}.bind(this));
		}
	});

	return MainPageTabsController;
});