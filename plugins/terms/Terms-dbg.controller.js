/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"retail/pmr/promotionaloffers/utils/Models",
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/plugins/terms/ConfigurationParser",
	"retail/pmr/promotionaloffers/plugins/terms/styles/StyleBuilder"
], function (Controller, JSONModel, Models, Utils, ConfigurationParser, StyleBuilder) {

	var verifyMethodsAreImplemented = function (object, methods) {
		var shouldThrow = false;
		methods.forEach(function (method) {
			if (!(object[method] instanceof Function)) {
				shouldThrow = true;
			}
		});

		if (shouldThrow) {
			throw new Error("A Terms Offer should implement the following methods: " + methods.join(", "));
		}
	};

	var getPurposes = function (staticData, data) {
		var allPurposes = (staticData || {}).Purpose || [];
		var purposes = data.map(function (loc) {
			return loc.Purpose;
		}).filter(function (value, index, self) {
			return self.indexOf(value) === index;
		}).map(function (purposeId) {
			var p = allPurposes.filter(function (x) {
				return x.PURPOSE_ID === purposeId;
			})[0] || {};
			return {
				Id: purposeId,
				Name: p.PURPOSE_DESC
			};
		});
		return purposes.length ? purposes : [{}];
	};

	function getOrElse(value, defaultValue) {
		if (value === null || value === undefined) {
			return defaultValue;
		}
		return value;
	}

	return Controller.extend("retail.pmr.promotionaloffers.plugins.terms.Terms", {
		extHookOnsetOfferData: null,
		extHookOngetOfferData: null,
		extHookOnvalidate: null,
		/**
		 * Constructor.
		 * @returns {void} - an instance of this controller.
		 */
		constructor: function () {
			this.currentController = null;
			this.model = new JSONModel();
			this.termStyles = new JSONModel({
				Selected: null,
				TermStyles: [],
				TermsMap: {}
			});
			this.versions = new JSONModel({
				Versions: []
			});
			this.contentModel = new JSONModel({
				EnforceMultiple: []
			});

		},
		/**
		 * Bind the view to the model
		 * @returns {void}
		 */
		onInit: function () {
			this.eventBus = sap.ui.getCore().getEventBus();

			var view = this.getView();
			this.termStyleContainer = view.byId("termStyleLayoutContainer");

			view.setModel(this.model);
			view.setModel(this.termStyles, "TermStyles");
			view.setModel(this.versions, "Versions");
			view.setModel(this.contentModel, "ContentModel");

			this.eventBus.subscribe("retail.pmr.promotionaloffers", "resetViews", this.resetView, this);
		},

		onExit: function () {
			this.eventBus.unsubscribe("retail.pmr.promotionaloffers", "resetViews", this.resetView, this);
		},

		/**
		 * Resets the view.
		 *
		 * @returns {void}
		 */
		resetView: function () {
			//this.termStyles.setProperty("/Selected", "005");
			this.termsStyleComboSelectionChanged();
		},

		setFinancialData: function (data) {
			if (this.currentController.setFinancialData) {
				this.currentController.setFinancialData(data);
			}
		},

		setFinancials: function (data) {
			this.currentController.setFinancials(data);
		},

		configTermStyles: function (styles) {
			var configStyles = this.getOwnerComponent().getTermStyles();
			var FREESTYLE_VIEW = "retail.pmr.promotionaloffers.plugins.terms.styles.Freestyle";
			var FREESTYLE_VIEW_TYPE = "XML";
			var configedStyles = styles.reduce(function (items, style) {
				var styleFromConfig = configStyles[style.Id];
				if (style.ConfigurationBased) {
					items.push({
						Group: style.Group,
						GroupDescription: style.GroupDescription,
						Active: style.Active,
						Id: style.Id,
						ViewName: FREESTYLE_VIEW,
						ViewType: FREESTYLE_VIEW_TYPE,
						Description: style.Description,
						ConfigurationBased: true,
						Type: style.Type,
						Sections: style.Sections.results.map(function (section) {
							function removeMetadata(item) {
								delete item.__metadata;
								return item;
							}

							function unwrapCollections(item) {
								for (var key in item) {
									if (!item.hasOwnProperty(key)) {
										continue;
									}
									if (item[key].hasOwnProperty("results")) {
										item[key] = item[key].results.map(unwrapCollections);

									}
								}
								return item;
							}

							return unwrapCollections(removeMetadata(section));
						})
					});
				} else if (styleFromConfig) {
					items.push({
						Group: style.Group,
						GroupDescription: style.GroupDescription,
						Active: style.Active,
						Id: style.Id,
						ViewName: styleFromConfig.ViewName,
						ViewType: styleFromConfig.ViewType,
						Description: style.Description
					});
				}
				return items;
			}, []);

			if (configedStyles.length === 0) {
				Utils.criticalError(Utils.getI18NModel(), "No term styles are configured.",
					"Caused by missing implementations for configured term styles",
					"Check that the term styles configured in 'Configuration.js' are implemented.",
					"Other possible cause is that there are no term styles marked as configuration based",
					"Call '/TermStyles' and make sure that at least one style exists and is marked as 'ConfigrationBased'");
			}

			return configedStyles;
		},
		setStaticData: function (staticData) {
			staticData = staticData || {};
			var packageOffer = this.generalDataModel.getDataModel().getProperty("/PackageOffer");
			var locationSubgroups = this.generalDataModel.getDataModel().getProperty("/LocationSubgroups");
			var featuresAvailable = Utils.setupFeatures(staticData.FeaturesAvailable || []);
			var hasGroupFeature = featuresAvailable.LocationSubgroups === "X";
			this.aPurposes = [];
			if (hasGroupFeature) {
				this.aPurposes = getPurposes(staticData, locationSubgroups || []);
			}

			var terms = this.configTermStyles(staticData.Terms || []);
			var termsData = this.termStyles.getData();
			termsData.TermStyles = terms.filter(function (style) {
				if (packageOffer) {
					return (style.Type === "P" && style.Active);
				} else {
					return (style.Type !== "P" && style.Active);
				}
			});

			termsData.TermsMap = terms.reduce(function (map, termStyle) {
				map[termStyle.Id] = termStyle;
				return map;
			}, {});

			this.staticData = staticData;

			this.termStyles.refresh();
			this.termStyles.setProperty("/Selected", packageOffer ? termsData.TermStyles[0].Id : "005"); //first style if package offer, else freestyle
			this.termsStyleComboSelectionChanged();

			var parseEnforceMultiple = (staticData.EnforceMultiple || []).map(function (item) {
				item.Key = item.Key === "" ? "No" : item.Key;
				return item;
			});

			this.contentModel.setProperty("/EnforceMultiple", parseEnforceMultiple);

		},

		validateTermStyleValue: function () {
			var value = this.termStyles.getProperty("/TermStyleValue") || "";
			var selected = this.termStyles.getProperty("/Selected");
			var propperValue = Utils.get(this.termStyles.getData(), ["TermsMap", selected, "Description"]) || "";
			var oMessageManager = Utils.getMessageManager();
			var i18nModel = Utils.setReuseI18NModel(this);

			Utils.removeMessagesByPath("/TermStyleValue");
			if (value.trim() !== propperValue.trim()) {
				oMessageManager.addMessages(new sap.ui.core.message.Message({
					message: i18nModel.getResourceBundle().getText("ErrorMessage.TermsStyle.Title"),
					description: i18nModel.getResourceBundle().getText("ErrorMessage.TermsStyle.Description"),
					type: "Error",
					target: "/TermStyleValue",
					processor: this.termStyles
				}));
				return 1;
			} else {
				return null;
			}

		},

		/**
		 * Validates form elements.
		 *
		 * @returns {void}
		 */
		validateForm: function () {
			var selected = this.termStyles.getProperty("/Selected");
			var oMessageManager = Utils.getMessageManager();
			var i18nModel = Utils.setReuseI18NModel(this);

			Utils.removeMessagesByPath("/TermStyleValue");
			Utils.removeMessagesByPath("/EnforceMultipleValue");
			if (!selected) {
				oMessageManager.addMessages(new sap.ui.core.message.Message({
					message: i18nModel.getResourceBundle().getText("ErrorMessage.TermsStyle.Title"),
					description: i18nModel.getResourceBundle().getText("ErrorMessage.TermsStyle.Description"),
					type: "Error",
					target: "/TermStyleValue",
					processor: this.termStyles
				}));
				return 1;
			}

			if (!this.contentModel.getProperty("/EnforceMultipleValue")) {
				oMessageManager.addMessages(new sap.ui.core.message.Message({
					message: i18nModel.getResourceBundle().getText("ErrorMessage.EnforceMultiple.Title"),
					description: i18nModel.getResourceBundle().getText("ErrorMessage.EnforceMultiple.Description"),
					type: "Error",
					target: "/EnforceMultipleValue",
					processor: this.contentModel
				}));
				return 1;
			}

			var invalidTermStyleValue = this.validateTermStyleValue();
			if (invalidTermStyleValue) {
				return invalidTermStyleValue;
			}

			if (!this.currentController) {
				return 1;
			}
			var errors = this.currentController.validate();
			if (isNaN(errors)) {
				throw new Error("Validate should return the numbers of errors on the current control");
			}

			if (errors > 0) {
				return errors;
			}

			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.plugins.terms.Terms~extHookOnvalidate 
			 * @return {integer} Number of errors
			 */
			if (this.extHookOnvalidate) {
				return this.extHookOnvalidate();
			}

			return 0;
		},

		/**
		 * Changes the current layout to the given layout
		 * @param {object} termStyle - The term style that will be put in place of the current one.
		 * @returns {void}
		 */
		switchStyleLayout: function (termStyle, bKeepEditability) {
			var container = this.termStyleContainer,
				view = null,
				controller = null;
			try {
				view = this.createView(termStyle.ViewName, termStyle.ViewType);
			} catch (e) {
				jQuery.sap.log.error(e);
				if (!termStyle) {
					return;
				}
				throw new Error("Can't load style " + termStyle.ViewName + " of type " + termStyle.ViewType + ", " +
					"it is added to the config file but not implemented. " +
					"Make sure that you place the style in the same package " +
					"and of the same type that you specify in the config file.");
			}
			controller = view.getController();
			if (controller.setRouter) {
				controller.setRouter(this.router);
			}
			if (controller.setGeneralModel) {
				controller.setGeneralModel(this.generalDataModel.getDataModel());
			}
			if (controller.setTermsModel) {
				controller.setTermsModel({
					contentModel: this.contentModel
				});

			}

			// In case we do not want to reset the Editable values we have to store them before resetting the data
			if (bKeepEditability) {
				var bEnforceMultipleEditable = this.contentModel.getProperty("/EnforceMultipleEditable");
				var bLimitEditable = this.contentModel.getProperty("/LimitEditable");
			}

			this.contentModel.setData({
				EnforceMultiple: this.staticData.EnforceMultiple || [],
				Editable: this.contentModel.getProperty("/Editable"),
				Purposes: this.aPurposes,
				ParentId: this.getView().getId().split("--")[1]
			});

			// And set the Properties again 
			if (bKeepEditability) {
				this.contentModel.setProperty("/EnforceMultipleEditable", bEnforceMultipleEditable);
				this.contentModel.setProperty("/LimitEditable", bLimitEditable);
			}

			verifyMethodsAreImplemented(controller, ["getOfferData", "setOfferData", "validate"]);
			this.setCurrentController(controller);
			this.attachToContainer(container, view);
		},

		/**
		 * Triggered by the style combo. This method builds the data for the switchStyleLayout method.
		 * @returns {void}
		 */
		termsStyleComboSelectionChanged: function (oEvent) {
			var termsData = this.termStyles.getData();
			var selectedKey = termsData.Selected;
			var termsMap = termsData.TermsMap;
			if (!selectedKey) {
				this.attachToContainer(this.termStyleContainer, null);
				this.setCurrentController(null);
			} else {
				this.termStyles.setProperty("/TermStyleValue", Utils.get(termsData, ["TermsMap", selectedKey, "Description"]) || "");
				var bKeepEditability = oEvent ? false : true;
				this.switchStyleLayout(termsMap[selectedKey], bKeepEditability);
				this.applyConfigToStyle(this.currentController, termsMap[selectedKey]);
			}
			if (oEvent && this.currentController) {
				this.currentController.setOfferData({
					staticData: this.staticData,
					Terms: [],
					Incentives: []
				});
				this.applyConfigToStyle(this.currentController, termsMap[selectedKey]);
			}
			this.validateForm();
		},

		enforceMultipleChanged: function (oEvent) {
			if (this.currentController.updateEnforceMultiple) {
				this.currentController.updateEnforceMultiple(this.contentModel.getProperty("/EnforceMultipleValue"));
			}

			this.validateForm();
		},

		/**
		 * creates a view of given type with given name
		 * @param {string} name - the name of the view to be created
		 * @param {string} type - the type of the view (ex. XML, JS, HTML)
		 * @returns {sap.ui.core.mvc.View} - the created view
		 */
		createView: function (name, type) {
			return StyleBuilder.getView(name, type, this.getView().getId());
		},
		/**
		 * It attached a view to a container.
		 * The container is cleared before the new view is attached.
		 * All items in the container are destroyed.
		 *
		 * @param {sap.ui.core.Control} container - the container that the view will be attached to.
		 * @param {sap.ui.core.mvc.View} view - the view that will be attache to the container
		 * @returns {void}
		 */
		attachToContainer: function (container, view) {
			container.removeAllContent();
			if (view) {
				container.addContent(view);
			}
		},
		/**
		 * Triggered when the Create Version button is clicked. Fires a "openVersionDialog" event.
		 * @returns {void}
		 */
		onVersionsButtonPress: function () {
			this.eventBus.publish("CreateOffer.terms.VersionDialog", "openVersionDialog", this.versions);
		},
		/**
		 * Loads all term styles from backend.
		 * @returns {Promise} - the terms style from the backend
		 */
		loadTermStyles: function () {
			return Models.getTermStyles();
		},
		/**
		 * Loads the 'EnforceMultiple' ComboBox values from the backend
		 * @returns {Promise} - the enforce multiple values from the backend
		 */
		loadEnforceMultiple: function () {
			return Models.getEnforceMultiple();
		},
		/**
		 * sets this currently active controller
		 * @param {sap.ui.core.Control} controller - the container that the view will be attached to.
		 * @return {void}
		 */
		setCurrentController: function (controller) {
			this.currentController = controller;
		},

		getFinancials: function () {
			if (this.currentController) {
				return this.currentController.getFinancials();
			}
			return {};
		},

		getTermsProductsFinancials: function () {
			if (this.currentController) {
				return this.currentController.getTermsProductsFinancials();
			}
			return {};
		},

		getOfferData: function () {

			var selected = this.termStyles.getProperty("/Selected");

			var terms = null;
			var incentives = null;

			if (this.currentController) {
				var offerData = this.currentController.getOfferData() || {
					Incentives: [],
					Terms: []
				};
				terms = offerData.Terms;
				incentives = offerData.Incentives;
			}

			var visibleEnforceMultiple = this.contentModel.getProperty("/EnforceMultipleVisible");
			if (visibleEnforceMultiple === null || visibleEnforceMultiple === undefined) {
				visibleEnforceMultiple = true;
			}
			var visibleLimit = this.contentModel.getProperty("/LimitVisible");
			if (visibleLimit === null || visibleLimit === undefined) {
				visibleLimit = true;
			}
			var termsForSave = {
				TermStyle: selected,
				Terms: terms || [],
				Incentives: incentives || []
			};

			var enforceMultipleValue = this.contentModel.getProperty("/EnforceMultipleValue");
			if (visibleEnforceMultiple && enforceMultipleValue !== null) {
				termsForSave.EnforceMultiple = enforceMultipleValue === "No" ? "" : enforceMultipleValue;
			}
			var limitValue = this.contentModel.getProperty("/LimitValue");
			if (visibleLimit && limitValue !== null) {
				termsForSave.Limit = limitValue + "";
			}
			var packageOffer = this.generalDataModel.getDataModel().getProperty("/PackageOffer");
			
			/* If it is a Packagaed Offer, the Enforce Multiple should be 'Yes' and ReadOnly */
			if (packageOffer === true) {
				this.contentModel.setProperty("/EnforceMultipleEditable", false);
			} else if (packageOffer === false) {
				this.contentModel.setProperty("/EnforceMultipleEditable", true);
			}

			if (this.contentModel.getProperty("/PackageValue") && packageOffer) {
				var packageValue = this.contentModel.getProperty("/PackageValue");
				var packageValueVisible = this.contentModel.getProperty("/PackageValueVisible");
				if (packageValueVisible && limitValue !== null) {
					termsForSave.PackageValue = packageValue + "";
				}
			}

			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.plugins.terms.Terms~extHookOngetOfferData 
			 * @param {object} termsForSave The terms data prepared for save
			 * @return {object} The modified terms
			 */
			if (this.extHookOngetOfferData) {
				termsForSave = this.extHookOngetOfferData(termsForSave);
			}

			return termsForSave;
		},
		determineCorrectTermStyle: function (serverSentStyle) {
			if (serverSentStyle) {
				return serverSentStyle;
			}

			var isPackageOffer = this.generalDataModel.getDataModel().getProperty("/PackageOffer");
			if (isPackageOffer) {
				return "011"; // package offer style
			} else {
				return "005"; // freestyle
			}

		},
		setOfferData: function (data, staticData) {

			/**    
			 * @ControllerHook [ Controller hook to manipulate customized code ]           
			 * @callback retail.pmr.promotionaloffers.plugins.terms.Terms~extHookOnsetOfferData 
			 * @param {object} data Offer data
			 * @param {object} staticData Static data from prefetch
			 * @return {object} The modified data
			 */
			if (this.extHookOnsetOfferData) {
				data = this.extHookOnsetOfferData(data, staticData);
			}

			//For better performance, we postpone model refresh to one single call
			//This is done via global variable in Models.js
			Models.postponeModelRefresh(true);

			if (staticData) {
				this.setStaticData(staticData);
			}
			var termsMap = this.termStyles.getData().TermsMap;
			var termStyle = this.determineCorrectTermStyle(data.TermStyle);
			var termsData = data.Terms || [];
			var incentives = data.Incentives || [];

			this.contentModel.setProperty("/Editable", !data.Readonly);
			//Set available term styles
			var aAllterms = this.termStyles.getData().TermStyles || [];
			var terms = [];
			var selectedItemData = this.termStyles.getData();
			for (var i = 0, iLen = aAllterms.length; i < iLen; i++) {
				if (aAllterms[i].Id === selectedItemData.Selected) {
					aAllterms[i].Active = true;
				}
				if (aAllterms[i].Active) {
					terms.push(aAllterms[i]);
				}
			}
			this.termStyles.setProperty("/TermStyles", terms);

			//Set current term style
			this.termStyles.setProperty("/Selected", termStyle);

			for (var i = 0, iLen = aAllterms.length; i < iLen; i++) {
				if (aAllterms[i].Id === selectedItemData.Selected) {
					this.termStyles.setProperty("/TermStyleValue", aAllterms[i].Description || "");
					this.switchStyleLayout(aAllterms[i]);
					break;
				}
			}

			var enforceMultipleValue = null;
			if (data.EnforceMultiple !== null && data.EnforceMultiple !== undefined) {
				enforceMultipleValue = data.EnforceMultiple || "No";
			} else {
				enforceMultipleValue = this.contentModel.getProperty("/EnforceMultipleValue") || "No";
			}

			var limitValue = data.Limit || this.contentModel.getProperty("/LimitValue");

			var packageValue = data.PackageValue || this.contentModel.getProperty("/PackageValue");
			var packageUserProjection = termsData.length ? (parseFloat(termsData[0].UserProjection) / parseFloat(termsData[0].Quantity)) || 0 :
				null;
			packageUserProjection = packageUserProjection || this.contentModel.getProperty("/UserProjectionValue");

			this.contentModel.setProperty("/EnforceMultipleValue", enforceMultipleValue);
			this.contentModel.setProperty("/LimitValue", limitValue);
			this.contentModel.setProperty("/PackageValue", packageValue);
			this.contentModel.setProperty("/UserProjectionValue", packageUserProjection);
			this.contentModel.setProperty("/Purposes", this.aPurposes);

			this.currentController.setOfferData({
				editable: !data.Readonly,
				Terms: termsData,
				Incentives: incentives,
				contentModel: this.contentModel,
				staticData: staticData
			});
			this.applyConfigToStyle(this.currentController, termsMap[termStyle]);

			Models.postponeModelRefresh(false);
		},

		applyConfigToStyle: function (controller, style) {
			if (!style) {
				Utils.criticalError(Utils.getI18NModel(), "The term style configured for current offer is not available",
					"Ensure that it is either implmented as a custom term style",
					"or that the given style is marked as 'ConfigurationBased' so that 'Freestyle' can be used");
			}
			if (!style.ConfigurationBased) {
				this.applyHeaderConfigs(null);
				return;
			}
			var configurationParser = new ConfigurationParser({
				configs: "Header"
			});
			var headerConfigs = configurationParser.parse(style.Sections);
			this.applyHeaderConfigs(headerConfigs.configs[0]);

			controller.applyConfigs(style.Sections);
		},
		applyHeaderConfigs: function (configOptions) {
			var defaultConfig = {
				Limit: {},
				EnforceMultiple: {},
				PackageValue: {},
				UserProjection: {}
			};
			var config = jQuery.extend(true, {}, defaultConfig, configOptions);

			var contentModelData = this.contentModel.getData();
			var contentModelConfigs = {
				LimitVisible: getOrElse(config.Limit.Visible, true),
				LimitEditable: getOrElse(config.Limit.Editable, true),
				LimitValue: getOrElse(config.Limit.DefaultValue, 0),

				EnforceMultiple: contentModelData.EnforceMultiple || [],
				EnforceMultipleVisible: getOrElse(config.EnforceMultiple.Visible, true),
				EnforceMultipleEditable: getOrElse(config.EnforceMultiple.Editable, true),
				EnforceMultipleValue: getOrElse(config.EnforceMultiple.DefaultValue, "X"),

				PackageValueVisible: getOrElse(config.PackageValue.Visible, true),
				PackageValueEditable: getOrElse(config.PackageValue.Editable, true),
				PackageValue: getOrElse(config.PackageValue.DefaultValue, null),

				UserProjectionVisible: getOrElse(config.UserProjection.Visible, true),
				UserProjectionEditable: getOrElse(config.UserProjection.Editable, true),
				UserProjectionValue: getOrElse(config.UserProjection.DefaultValue, "0")
			};
			Object.keys(contentModelConfigs).forEach(function (name) {
				//if(!contentModelData[name] || contentModelData[name] != contentModelConfigs[name]) {
				if (contentModelData[name] == undefined) {
					contentModelData[name] = contentModelConfigs[name];
				}
			});
			this.contentModel.setData(contentModelData);
		},
		resetOfferData: function () {
			this.setStaticData(this.staticData);
			this.contentModel.setProperty("/EnforceMultipleValue", "X");
			this.contentModel.setProperty("/LimitValue", "0");
			this.contentModel.setProperty("/PackageValue", null);
			this.contentModel.setProperty("/Purposes", this.aPurposes);

			this.currentController.setOfferData({
				staticData: this.staticData
			});
			var data = this.termStyles.getData();
			this.applyConfigToStyle(this.currentController, data.TermsMap[data.Selected]);
		},
		setRouter: function (router) {
			this.router = router;
		},
		setGeneralDataModel: function (model) {
			this.generalDataModel = model;
			this.getView().setModel(model.getDataModel(), "GeneralModel");
		},

		processServerErrors: function (aMessages) {
			if (this.currentController && this.currentController.processServerErrors) {
				this.currentController.processServerErrors(aMessages);
			}
		},
		handlePositiveNumeric: function (oEvent) {
			Utils.validationHandler("greaterOrEqualValidation", oEvent, "/LimitValue", null, this.contentModel);
		},
		updatePackagePrice: function (oEvent) {
			Utils.validationHandler("greaterOrEqualValidation", oEvent, "/PackageValue", null, this.contentModel);
			if (this.currentController.updatePackage) {
				this.currentController.updatePackage(function rewardPackageValue(reward) {
					return reward.PackageValue;
				});
			}
		},

		updatePackageTotal: function (oEvent) {
			Utils.validationHandler("greaterOrEqualValidation", oEvent, "/UserProjectionValue", null, this.contentModel);
			if (this.currentController.updatePackageUserProjection) {
				this.currentController.updatePackageUserProjection(false);
			}
		},
		formatterBool: function (val1, val2) {
			return val1 && val2;
		},
		labelFormatter: function (enforceMVisible, label1, limitVisible, label2) {
			var label = [];
			if (enforceMVisible) {
				label.push(label1);
			}

			if (limitVisible) {
				label.push(label2);
			}
			return label.length > 1 ? label.join(" / ") : label.join();
		},
		getSelectedTermStyle: function () {
			return this.termStyles.getProperty("/Selected");
		}
	});
}, true);