/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"retail/pmr/promotionaloffers/utils/Models",
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
	"retail/pmr/promotionaloffers/utils/DateHandler",
	"sap/ui/model/Filter",
	"sap/ui/core/ListItem",
	"sap/ui/comp/filterbar/FilterGroupItem",
	"retail/pmr/promotionaloffers/plugins/general/dynamicfilter/DynamicFilterController",
	"retail/pmr/promotionaloffers/plugins/general/LocationSelector",
	"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer",
	"retail/pmr/promotionaloffers/utils/Formatter",
	"sap/ui/comp/odata/MetadataAnalyser",
	"sap/ui/comp/providers/ValueHelpProvider",
	"sap/ui/comp/providers/ValueListProvider"
], function (Controller, JSONModel, Models, Utils, TreeValueHelpDialog, DateHandler, Filter,
	ListItem, FilterGroupItem, DynamicFilterController, LocationSelector,
	ValueHelpDialogTokenizer, FormatterHelper, MetadataAnalyser, ValueHelpProvider, ValueListProvider) {
	"use strict";

	var promptUserReferenceEventChanged = function (i18n, update, dupdate) {
		return Utils.promptUser({
			i18n: i18n,
			title: "{i18n>CreateOffer.General.ReferenceEvent}",
			type: "Message",
			state: "Warning",
			text: "{i18n>CreateOffer.General.ReferenceEvent.DialogText}",
			ok: "{i18n>CreateOffer.General.ConfirmYes}",
			cancel: "{i18n>CreateOffer.General.Reject}",
			okValue: function () {
				return update();
			},
			cancelValue: function () {
				return dupdate();
			}
		});
	};

	var promptUserManualExclusionSwitch = function (i18n, update, dupdate) {
		return Utils.promptUser({
			i18n: i18n,
			title: "{i18n>CreateOffer.General.Confirm}",
			type: "Message",
			state: "Warning",
			text: "{i18n>CreateOffer.General.ManualExclusionSwitch.DialogText}",
			ok: "{i18n>CreateOffer.General.ConfirmYes}",
			cancel: "{i18n>CreateOffer.General.Reject}",
			okValue: function () {
				return update();
			},
			cancelValue: function () {
				return Promise.resolve();
			}
		});
	};

	var promptUserForPackageOfferChange = function (newValue, i18n) {
		return Utils.promptUser({
			i18n: i18n,
			title: "{i18n>CreateOffer.General.PackageOffer}",
			type: "Message",
			state: "Warning",
			text: "{i18n>CreateOffer.General.PackageOffer.Warning}",
			ok: "{i18n>CreateOffer.General.MasterDataSystem.Ok}",
			cancel: "{i18n>CreateOffer.General.MasterDataSystem.Cancel}",
			okValue: function () {
				return newValue;
			},
			cancelValue: function () {
				return !newValue;
			}
		});
	};

	var promptUserForMasterDataSystemChange = function (newSystem, oldSystem, i18n) {
		return Utils.promptUser({
			i18n: i18n,
			title: "{i18n>CreateOffer.General.MasterDataSystemDialog.Title}",
			type: "Message",
			state: "Warning",
			text: "{i18n>CreateOffer.General.MasterDataSystemDialog.Message}",
			ok: "{i18n>CreateOffer.General.MasterDataSystem.Ok}",
			cancel: "{i18n>CreateOffer.General.MasterDataSystem.Cancel}",
			okValue: function () {
				return newSystem;
			},
			cancelValue: function () {
				return oldSystem;
			}
		});
	};

	function deleteUnneededFields(oData) {
		var fields = ["PurchasingGroupName"];

		fields.forEach(function (field) {
			delete oData[field];
		});
	}

	function getNewVersionsNotOnExcluded(versions, localNodes, excluded) {
		return (versions || []).filter(notOnExcluded(localNodes, excluded));
	}

	function getNewLocalNodes(newVersions, localNodes) {
		var validLocationIds = newVersions.map(Utils.prop("ExtLocationNodeId"));

		return (localNodes || []).filter(function (node) {
			var id = node.Description || node.Id;
			return validLocationIds.indexOf(id) > -1;
		});
	}

	function notOnExcluded(localNodes, excluded) {
		return function (version) {
			return Utils.isNotOnExcluded(version, localNodes, excluded);
		};
	}

	function withVersionsOnExcluded(localNodes, excluded) {
		return function (version) {
			return !Utils.isNotOnExcluded(version, localNodes, excluded);
		};
	}

	function promptForVersionsOnExcluded(versions, localNodes, excluded) {
		if (versions && versions.some(withVersionsOnExcluded(localNodes, excluded))) {
			return Utils.openDeleteConfirmDiaog(true, {
				"massageSingle": "General.Versions.On.ExcludedNodes",
				"messageMulti": "ManageVersions.DeleteVersionDialog.Message",
				"title": "ManageVersions.DeleteVersionDialog.Title"
			});
		} else {
			return Promise.resolve();
		}
	}

	function withInvalidDates(startDate, endDate) {
		return function (version) {
			return !Utils.isInOfferRange(version, startDate, endDate);
		};
	}

	function toDateRange(version) {
		return {
			StartOfOffer: version.StartOfOffer,
			EndOfOffer: version.EndOfOffer
		};
	}

	function promptForVersionChange(dateHandler, versions) {
		var startDate = dateHandler.getCombinedStartDate();
		var endDate = dateHandler.getCombinedEndDate();
		var shouldPromptUser = versions
			.map(toDateRange)
			.map(DateHandler.updateRangeIfSame(dateHandler))
			.some(withInvalidDates(startDate, endDate));

		if (shouldPromptUser) {
			return Utils.openDeleteConfirmDiaog(true, {
				"massageSingle": "General.Versions.Not.In.Offer.Range",
				"messageMulti": "ManageVersions.DeleteVersionDialog.Message",
				"title": "ManageVersions.DeleteVersionDialog.Title"
			});
		} else {
			return Promise.resolve();
		}
	}

	return Controller.extend("retail.pmr.promotionaloffers.plugins.general.General", {
		extHookOnsetOfferData: null,
		extHookOnvalidateForm: null,
		extHookOngetOfferData: null,
		constructor: function () {
			this.eventBus = null;
			this.contentModel = new JSONModel({
				"TacticTypes": [],
				"Statuses": []
			});
			this.offerSetModel = new JSONModel({
				"OfferSets": []
			});
			this.contentModel.setSizeLimit(Utils.getSizeLimit());

			this.CONSTANTS = {};
			Object.defineProperty(this.CONSTANTS, "TARGET_GROUP_EMPTY_ROW", {
				value: {
					"RedeemEnabled": false
				},
				writable: false
			});

			this.dataModel = new JSONModel({
				"Tactics": [],
				"TargetGroups": []
			});
			this.timeModel = new JSONModel();
			this.featuresAvailable = new JSONModel();
			this.dateHandler = new DateHandler();

		},

		onInit: function () {
			this.eventBus = sap.ui.getCore().getEventBus();
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);
			this.getView().setModel(this.timeModel, "Time");
			this.i18nModel = Utils.getResourceModel();
			this.oMarketingArea = this.getView().byId("generalMarketingArea");
			this.getView().setModel(this.featuresAvailable, "featuresAvailable");

			this.bLocSuggestSelect = false;
			this.oCachedHierarchies = {};
			this.lastSeachLocationData = [];
			this.oLocationSelector = null;

			function inRange(start, end) {
				return function (version) {
					return Utils.isInOfferRange(version, start, end);
				};
			}

			function removeBadVersions(dateHandler, dataModel) {
				var versions = dataModel.getProperty("/Versions");
				var localNodes = dataModel.getProperty("/LocalNodes");

				var start = dateHandler.getCombinedStartDate();
				var end = dateHandler.getCombinedEndDate();

				var newVersions = versions.filter(inRange(start, end));
				dataModel.setProperty("/Versions", newVersions);

				var newLocalNodes = getNewLocalNodes(newVersions, localNodes);
				dataModel.setProperty("/LocalNodes", newLocalNodes);

				var eventParams = {
					versions: newVersions,
					localNodes: newLocalNodes
				};
				sap.ui.getCore().getEventBus().publish("retail.pmr.promotionaloffers", "deleteInvalidVersions", eventParams);
			}
			this.dateHandler.attachEvent("dateChanged", function (oEvent) {
				var source = oEvent.getSource();

				promptForVersionChange(oEvent.getSource(), this.dataModel.getProperty("/Versions") || []).then(function () {
					this.dataModel.setProperty("/StartOfOffer", source.getStartDate());
					this.dataModel.setProperty("/EndOfOffer", source.getEndDate());
					this.timeModel.setProperty("/StartTime", source.getStartTime());
					this.timeModel.setProperty("/EndTime", source.getEndTime());

					this.setWeekForStartOfOffer(source.getStartDate());
					this.setWeekForEndOfOffer(source.getEndDate());

					this.timeModel.refresh(true);

					//update tactics
					this.dateHandler.updateTactics(this.dataModel, this.timeModel);

					//update versions
					this.dateHandler.updateVersions(this.dataModel);
					removeBadVersions(this.dateHandler, this.dataModel);

					this.validateTactics();
					this.validateDates();

				}.bind(this), function () {
					this.dataModel.setProperty("/StartOfOffer", source.getPrevStartDate());
					this.dataModel.setProperty("/EndOfOffer", source.getPrevEndDate());
					this.timeModel.setProperty("/StartTime", source.getPrevStartTime());
					this.timeModel.setProperty("/EndTime", source.getPrevEndTime());
				}.bind(this));
			}.bind(this));

			this.manageOfferSetsDialog = sap.ui.xmlfragment(
				"retail.pmr.promotionaloffers.plugins.general.ManageOfferSetsDialog",
				this.getView().getController()
			);
			this.getView().addDependent(this.manageOfferSetsDialog);

			this._targetGroupDialog = sap.ui.xmlfragment(
				"retail.pmr.promotionaloffers.plugins.general.TargetGroupSearch",
				this.getView().getController()
			);

			this._tacticsDialog = sap.ui.xmlfragment(
				"retail.pmr.promotionaloffers.plugins.general.TacticSearch",
				this.getView().getController()
			);
			this._tacticsDialog.setModel(this.contentModel);
			this.oMessageManager = Utils.getMessageManager();
		},

		onExit: function () {},

		processServerErrors: function (aMessages) {
			Utils.setErrorMessages(this.oMessageManager, aMessages, this.dataModel);
		},

		setSystem: function (newSystem, bKeepTerms) {
			this.dataModel.setProperty("/MasterdataSystem", newSystem);
			this.setMasterDataSystemDependentCombos(newSystem);
			this.eventBus.publish("retail.pmr.promotionaloffers", "resetViews", {
				MasterdataSystem: newSystem
			});
			// In case of Event Change, we want to keep the Terms
			if(!bKeepTerms){
				this.eventBus.publish("retail.pmr.promotionaloffers", "resetTermsTab");
			}
			this.eventBus.publish("retail.pmr.promotionaloffers", "setMasterDataSystem", {
				SelectedMasterDataSystem: newSystem
			});

			this.contentModel.setProperty("/LocationText", "");
			this.dataModel.setProperty("/LocationNodeId", "");
			this.dataModel.setProperty("/LocationFilters", []);
			this.dataModel.setProperty("/ExcludedNodes", []);
			this.dataModel.setProperty("/LeadingCategory", "");
			this.dataModel.setProperty("/PromotionType", "");
			this.dataModel.setProperty("/PurchasingGroup", "");
			this.dataModel.setProperty("/LeadingCategoryName", "");
			this.contentModel.setProperty("/LocationStores", "");
			return Promise.resolve(newSystem);
		},

		resetSystem: function (oldSystem) {
			this.contentModel.setProperty("/LastMasterdataSystem", oldSystem);
			this.dataModel.setProperty("/MasterdataSystem", oldSystem);
		},

		masterdataSystemChange: function (system) {
			var that = this;

			var shouldPromptUser = function shouldPromptUser() {
				return ["/LocationNodeId", "/PromotionType", "/LeadingCategory", "/PurchasingGroup"].map(function (item) {
					return !!that.dataModel.getProperty(item);
				}).reduce(function (result, data) {
					return data || result;
				}, false);
			};

			var promptUser = function promptUser() {
				return promptUserForMasterDataSystemChange(system, that.contentModel.getProperty("/LastMasterdataSystem"), that.getView().getModel(
					"i18n"));
			};

			if (shouldPromptUser()) {
				return promptUser().then(that.setSystem.bind(that), that.resetSystem.bind(that));
			} else {
				setTimeout(function () {
					that.setSystem(system);
				});
				return Promise.resolve(system);
			}
		},

		timePickerVisible: function (selected) {
			return !selected ? "L6 M6 S6" : "L12 M12 S12";
		},

		onAllDaySelect: function (oEvent) {
			var selected = oEvent.getParameter("selected");

			if (selected) {
				this.dateHandler.onAllDaySelect();
			}
			this.timeModel.setProperty("/Selected", selected);
			this.timeModel.refresh(true);
		},

		/**
		 * Sets Leading Category, based on master data system selection.
		 *
		 * @param {string} sMasterDataSystem The master data system id.
		 * @returns {object} The promise with the response
		 */
		setLeadingCategory: function (sMasterDataSystem) {
			var editable = this.contentModel.getProperty("/Editable");
			if (!editable) {
				return;
			}
			this.contentModel.setProperty("/LeadingCategoryBusy", true);
			// read leading category
			return Models.getLeadingCategoriesSet(sMasterDataSystem).then(function (aLeadingCategoriesSet) {
				this.contentModel.setProperty("/LeadingCategoriesSet", aLeadingCategoriesSet);
				this.contentModel.setProperty("/LeadingCategoryBusy", false);
			}.bind(this));
		},

		/**
		 * Sets data to dependent master data system combos, based on master data system selection.
		 *
		 * @param {string} sMasterDataSystem The master data system id.
		 * @returns {void}
		 */
		setMasterDataSystemDependentCombos: function (sMasterDataSystem) {
			this.contentModel.setProperty("/PromotionTypeEnabled", false);
			this.contentModel.setProperty("/PurchasingGroupEnabled", false);
			this.contentModel.setProperty("/LeadingCategoriesSet", []);

			return Models.getPromotionTypeSetAndPurchasingGroupSet(sMasterDataSystem).then(function (results) {
				var promotionTypeSet = results[0];
				var purchasingGroupSet = results[1];

				this.contentModel.setProperty("/PromotionTypeSet", promotionTypeSet);
				this.contentModel.setProperty("/PromotionTypeEnabled", true);

				this.contentModel.setProperty("/PurchasingGroupSet", purchasingGroupSet);
				this.contentModel.setProperty("/PurchasingGroupEnabled", true);

				this.contentModel.setProperty("/TotalAudience", this.getTotalAudience(this.dataModel.getProperty("/TargetGroups")));

			}.bind(this));

		},

		purchasingGroupChanged: function (oEvent) {
			var selectedKey = this.dataModel.getProperty("/PurchasingGroup");
			var value = this.getView().byId("generalPurchasingGroup").getValue();
			if (value === "" || value === null) {
				Utils.removeMessagesByPath("/PurchasingGroup");
				return;
			}
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPurchasingGroup.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPurchasingGroup.Invalid.Description")
			};
			this.validateByPath("/PurchasingGroup", this.dataModel, message, function () {
				return selectedKey;
			});
		},

		promotionTypeChanged: function (oEvent) {
			var selectedKey = this.dataModel.getProperty("/PromotionType");
			var value = this.getView().byId("generalPromotionType").getValue();
			if (value === "" || value === null) {
				Utils.removeMessagesByPath("/PromotionType");
				return;
			}
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPromotionType.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPromotionType.Invalid.Description")
			};
			this.validateByPath("/PromotionType", this.dataModel, message, function () {
				return selectedKey;
			});
		},

		validateByPath: function (path, model, message, fNoErrors) {
			Utils.removeMessagesByPath(path);
			if (fNoErrors()) {
				return 0;
			}
			var oErr = {
				target: path,
				type: "Error",
				processor: model,
				message: message.message,
				description: message.description
			};

			Utils.setErrorMessages(this.oMessageManager, [oErr]);
			return 1;
		},

		validateName: function () {
			var name = this.dataModel.getProperty("/Name");
			var value = name ? name.trim() : "";
			var message = {};
			if (value.length > 40) {
				message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.TitleTooLong"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.DescriptionTooLong")
				};
			} else {
				message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.Title"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.Description")
				};
			}
			return this.validateByPath("/Name", this.dataModel, message, function () {
				return (value.length > 0 && value.length <= 40);
			});
		},

		validateMarketingArea: function () {
			var selectedKey = this.dataModel.getProperty("/MarketingArea");
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralMarketingArea.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralMarketingArea.Invalid.Description")
			};
			var value = this.oMarketingArea.getValue();
			return this.validateByPath("/MarketingArea", this.dataModel, message, function () {
				return !(value && !selectedKey);
			});
		},

		validateLocation: function () {
			var value = this.contentModel.getProperty("/LocationText");
			var message = {};
			if (!value) {
				message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLocation.Title"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLocation.Description")
				};
			} else {
				message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLocation.Invalid.Title"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLocation.Invalid.Description")
				};
			}
			return this.validateByPath("/LocationText", this.contentModel, message, function () {
				return value && value.length > 0 && this.dataModel.getProperty("/LocationNodeId");
			}.bind(this));

		},
		validateDates: function () {
			var validateStartOfOffer = function () {
				var value = this.timeModel.getProperty("/StartOfOfferValue");
				var message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Invalid.Title"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Description")
				};
				if (!value) {
					message.message = this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Title");
				}

				return this.validateByPath("/StartOfOfferValue", this.timeModel, message, function () {
					return this.validOfferDate("StartOfOffer");
				}.bind(this));
			};
			var validateEndOfOffer = function () {
				var value = this.timeModel.getProperty("/EndOfOfferValue");
				var message = {
					message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Invalid.Title"),
					description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Description")
				};
				if (!value) {
					message.message = this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Title");
				}
				return this.validateByPath("/EndOfOfferValue", this.timeModel, message, function () {
					return this.validOfferDate("EndOfOffer");
				}.bind(this));
			};
			return validateStartOfOffer.call(this) + validateEndOfOffer.call(this);
		},

		validateLeadingCategory: function () {
			var value = this.dataModel.getProperty("/LeadingCategoryName");
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLeadingCategory.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLeadingCategory.Invalid.Description")
			};
			return this.validateByPath("/LeadingCategoryName", this.dataModel, message, function () {
				return (!value || this.dataModel.getProperty("/LeadingCategory"));
			}.bind(this));
		},

		validateOfferSet: function () {
			var value = this.contentModel.getProperty("/OfferSetValue");
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferSet.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferSet.Invalid.Description")
			};
			return this.validateByPath("/OfferSetValue", this.contentModel, message, function () {
				return (!value || !!value && this.dataModel.getProperty("/OfferSetId"));
			}.bind(this));
		},

		validateReferenceEvent: function () {
			var value = this.contentModel.getProperty("/ReferenceEventText");
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralReferenceEvent.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralReferenceEvent.Invalid.Description")
			};

			return this.validateByPath("/ReferenceEventText", this.contentModel, message, function () {
				return (!value || this.contentModel.getProperty("/ReferenceEvent"));
			}.bind(this));

		},
		validateForm: function () {
			var validate = this.validateName() + this.validateLocation() + this.validateLeadingCategory() + this.validateDates() + this.validateOfferSet() +
				this.validateReferenceEvent() + this.validateTargetGroups() + this.validateTactics() + this.validateMarketingArea();
			/**
			 * @ControllerHook [Extend validate form]
			 * @callback retail.pmr.promotionaloffers.plugins.general.General~extHookOnvalidateForm
			 * @return {number} - Numbers of errors
			 */
			if (this.extHookOnvalidateForm) {
				return validate + this.extHookOnvalidateForm();
			}

			this.eventBus.publish("retail.pmr.promotionaloffers", "toggleCollisionBtn", {});

			return validate;
		},

		formatRefEventValue: function (id, name) {
			if (!id) {
				return;
			}
			var textToReturn = parseInt(id, 10).toString();
			if (name) {
				textToReturn = name + " (" + textToReturn + ")";
			}
			return textToReturn;
		},

		offerSetChanged: function (e) {
			var that = this;
			var offerset = this.getModelDataFromAnnotation(e);
			var offerValue = offerset.Text || offerset;

			this.dataModel.setProperty("/OfferSetName", null);
			this.dataModel.setProperty("/OfferSetId", null);
			that.contentModel.setProperty("/OfferSetValue", offerValue);

			if (!offerValue) {
				this.validateOfferSet();
				return;
			}
			var filter = {
				"$filter": "Text eq'" + offerValue + "'"
			};
			Models.getOfferSet(filter).then(function (returnData) {
				if (returnData.data.length) {
					var selectedOfferSet = returnData.data[0];
					that.dataModel.setProperty("/OfferSetName", selectedOfferSet.Text);
					that.dataModel.setProperty("/OfferSetId", selectedOfferSet.Id);
				}
				that.validateOfferSet();
			});
		},
		referenceSuggestionSelected: function (oEvent) {
			var id = this.getModelDataFromAnnotation(oEvent).Id;
			oEvent.getSource().setValue(id);
			this.referenceEventChanged(oEvent);
		},

		updateReferenceEventFields: function (referenceEvent) {
			var that = this;

			function setDates(refEvent) {
				var oldStartDate = Utils.getFormatedDateForRead(refEvent.StartDate);
				var oldEndDate = Utils.getFormatedDateForRead(refEvent.EndDate);
				var startDate = that.getDate(oldStartDate);
				var endDate = that.getDate(oldEndDate);

				var startTime = that.getTime(oldStartDate);
				var endTime = that.getTime(oldEndDate);

				that.timeModel.setData({
					Selected: Utils.isAllDay(startDate, endDate),
					StartTime: startTime,
					EndTime: endTime,
					PreviousStartOfOffer: startDate,
					PreviousEndOfOffer: endDate,
					PreviousStartTime: startTime,
					PreviousEndTime: endTime,
					ValidStartOfOffer: true,
					ValidEndOfOffer: true
				});

				that.dateHandler.setStartDate(startDate);
				that.dateHandler.setEndDate(endDate);
				that.dateHandler.setStartTime(startTime);
				that.dateHandler.setEndTime(endTime);
				that.dateHandler.setPrevStartDate(startDate);
				that.dateHandler.setPrevEndDate(endDate);
				that.dateHandler.setPrevStartTime(startTime);
				that.dateHandler.setPrevEndTime(endTime);

				that.setWeekForStartOfOffer(startDate);
				that.setWeekForEndOfOffer(endDate);

				that.dataModel.setProperty("/StartOfOffer", startDate);
				that.dataModel.setProperty("/EndOfOffer", endDate);

				return Promise.resolve(refEvent);
			}

			function setMasterDataSystem(refEvent, sMasterDataSystem) {
				if (refEvent.MasterdataSystem != sMasterDataSystem){
					var bKeepTerms = false;
				}else{
					bKeepTerms = true;
				}
				return that.setSystem(refEvent.MasterdataSystem, bKeepTerms).then(function () {
					return refEvent;
				});
			}

			function setTactics(refEvent) {
				var tactic = that.contentModel.getProperty("/TacticTypes").filter(function (tacticType) {
					return refEvent.Tactic === tacticType.TacticId && refEvent.TacticType === tacticType.TacticType;
				})[0];

				that.dataModel.setProperty("/Tactics", []);
				var newTactic = that.addNewTactic(tactic.Id, tactic.Name);
				newTactic.TacticType = refEvent.TacticType;
				newTactic.TacticId = refEvent.Tactic;

				return Promise.resolve(refEvent);
			}

			function setLocationHierarchy(refEvent) {
				var filter = "HierarchyId eq '" + refEvent.HierarchyId + "'";
				return that.setLocationHierarchy(filter).then(function () {
					return Promise.resolve(refEvent);
				});
			}

			this.contentModel.setProperty("/ReferenceEvent", referenceEvent.Id);
			var newValue = this.formatRefEventValue(referenceEvent.Id, referenceEvent.Name);
			this.contentModel.setProperty("/ReferenceEventText", newValue);

			return Promise.resolve(referenceEvent)
				.then(setDates)
				.then(setMasterDataSystem(referenceEvent, this.dataModel.getProperty("/MasterdataSystem")))
				.then(setTactics)
				.then(setLocationHierarchy)
				.then(function (event) {
					this.dataModel.setProperty("/RefEventId", event.Id);
					this.dataModel.setProperty("/RefEventName", event.Name);

					//reset versions
					this.dataModel.setProperty("/Versions", []);
					this.dataModel.setProperty("/LocalNodes", []);
					var eventParams = {
						versions: this.dataModel.getProperty("/Versions"),
						localNodes: this.dataModel.getProperty("/LocalNodes")
					};
					this.eventBus.publish("retail.pmr.promotionaloffers", "deleteInvalidVersions", eventParams);

					this.validateForm();

				}.bind(this));
		},

		marketingAreaChanged: function (oEvent) {
			var marketingArea = this.dataModel.getProperty("/MarketingArea");
			this.contentModel.setProperty("/MarketingAreaFilter", {
				MarketingArea: marketingArea
			});
			var targetGroups = (this.dataModel.getProperty("/TargetGroups") || []).filter(function (targetGroup) {
				return targetGroup.MarketingArea === marketingArea;
			});
			var nTotalAudience = this.getTotalAudience(targetGroups);
			this.contentModel.setProperty("/TotalAudience", nTotalAudience);
			
			this.dataModel.setProperty("/TargetGroups", targetGroups);
			this.validateMarketingArea();
		},

		referenceEventChanged: function (oEvent) {
			if (!oEvent) {
				return;
			}

			function dontUpdateFields(that, refEvent) {
				this.contentModel.setProperty("/ReferenceEvent", this.dataModel.getProperty("/RefEventId"));
				var name = this.dataModel.getProperty("/RefEventName");
				var id = this.dataModel.getProperty("/RefEventId");
				name = this.formatRefEventValue(id, name);
				this.contentModel.setProperty("/ReferenceEventText", name);
				this.validateReferenceEvent();
			}

			var value = oEvent.getSource().getValue();
			Models.getReferenceEvent(value).then(function (result) {
				var refEvent = result[0];
				if (refEvent) {
					promptUserReferenceEventChanged(this.getView().getModel("i18n"), this.updateReferenceEventFields.bind(this, refEvent),
						dontUpdateFields.bind(this, refEvent));
				} else {
					this.contentModel.setProperty("/ReferenceEvent", refEvent);
					this.dataModel.setProperty("/RefEventId", refEvent);
					this.dataModel.setProperty("/RefEventName", refEvent);
					this.validateReferenceEvent();
				}
			}.bind(this));
		},

		/**
		 * Sets the week for start of offer to the summary.
		 *
		 * @param {object} oStartOfOffer The start of offer. If null, it will not search for the week and it will clear the (previous) week.
		 * @returns {void}
		 */
		setWeekForStartOfOffer: function (oStartOfOffer) {
			if (!oStartOfOffer) {
				this.timeModel.setProperty("/StartWeek", "");
				return;
			}
			Utils.getWeek(oStartOfOffer).then(function (sWeek) {
				this.timeModel.setProperty("/StartWeek", sWeek.trim());
			}.bind(this), function () {
				this.timeModel.setProperty("/StartWeek", "");
			}.bind(this));
		},

		/**
		 * Sets the week for end of offer to the summary.
		 *
		 * @param {object} oEndOfOffer The end of offer. If null, it will not search for the week and it will clear the (previous) week.
		 * @returns {void}
		 */
		setWeekForEndOfOffer: function (oEndOfOffer) {
			if (!oEndOfOffer) {
				this.timeModel.setProperty("/EndWeek", "");
				return;
			}
			Utils.getWeek(oEndOfOffer).then(function (sWeek) {
				this.timeModel.setProperty("/EndWeek", sWeek.trim());
			}.bind(this), function () {
				this.timeModel.setProperty("/EndWeek", "");
			}.bind(this));
		},

		/**
		 * Checks if offer date is valid.
		 *
		 * @param {string} sType The date type: StartOfOffer or EndOfOffer.
		 * @returns {boolean} True if the date is valid, false otherwise.
		 */
		validOfferDate: function (sType) {
			var bValid = true;
			var oStartOfOffer = this.dataModel.getProperty("/StartOfOffer");
			var oEndOfOffer = this.dataModel.getProperty("/EndOfOffer");
			switch (sType) {
			case "StartOfOffer":
				if (!oStartOfOffer) {
					bValid = false;
				} else if (oEndOfOffer && oStartOfOffer.getTime() > oEndOfOffer.getTime()) {
					bValid = false;
				}
				break;
			case "EndOfOffer":
				if (!oEndOfOffer) {
					bValid = false;
				} else if (oStartOfOffer && oStartOfOffer.getTime() > oEndOfOffer.getTime()) {
					bValid = false;
				}
				break;
			}
			return bValid;
		},

		getModelDataFromAnnotation: function (oEvent) {
			var oSelectedItem = {};
			if (oEvent.getParameter("tokens")) {
				oSelectedItem = oEvent.getParameter("tokens")[0].data("row");
			} else if (oEvent.getParameter("value") === oEvent.getParameter("value") + "") {
				return oEvent.getParameter("value");
			} else {
				var row = oEvent.getParameter("selectedRow");
				var modelPath = row.getBindingContext("Annotation").getPath();
				oSelectedItem = row.getBindingContext("Annotation").getModel().getProperty(modelPath);
			}
			return oSelectedItem;
		},

		updateLocationHierarchyOnDateChange: function (aData) {
			var dataModel = this.dataModel.getData();

			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.general.LocationTree", this);
			var selector = new LocationSelector(table);

			if (aData.data.length) {
				this.cacheLocations(aData.data[0].HierarchyId, aData.data);
			}

			var includeExclude = {
				ID: dataModel.LocationNodeId,
				ExcludeNodes: []
			};
			var locationSet = this.getHierarchiesWithCache(aData.data);

			selector.setData(includeExclude, locationSet, {
				StartOfOffer: dataModel.StartOfOffer.getTime(),
				EndOfOffer: dataModel.EndOfOffer.getTime()
			});

			var selections = selector.getSelection();
			var includeNode = selections.selection;
			var excludedNodes = selections.exclusions;

			this.contentModel.setProperty("/Hierarchy", includeNode);
			var extNodeId = this.contentModel.getProperty("/ExtNodeId");

			this.eventBus.publish("retail.pmr.promotionaloffers", "setLocationSelection", {
				includeNode: includeNode,
				excludedNodes: excludedNodes,
				hierarchy: includeNode
			});
		},

		removeBadVersionsOnExcluded: function (dataModel, excluded) {
			var versions = dataModel.getProperty("/Versions");
			var localNodes = dataModel.getProperty("/LocalNodes");

			var newVersions = getNewVersionsNotOnExcluded(versions, localNodes, excluded);
			dataModel.setProperty("/Versions", newVersions);

			var newLocalNodes = getNewLocalNodes(newVersions, localNodes);
			dataModel.setProperty("/LocalNodes", newLocalNodes);

			var eventParams = {
				versions: newVersions,
				localNodes: localNodes
			};
			sap.ui.getCore().getEventBus().publish("retail.pmr.promotionaloffers", "deleteInvalidVersions", eventParams);
		},
		/**
		 * Triggered when changing the start date of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferStartDateChange: function (oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if (!valid) {
				this.timeModel.setProperty("/StartOfOfferValue", Utils.getFormatDatePiker(date));
			}
			this.dateHandler.startDateChanged(date, valid);
		},

		/**
		 * Triggered when changing the end date of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferEndDateChange: function (oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if (!valid) {
				this.timeModel.setProperty("/EndOfOfferValue", Utils.getFormatDatePiker(date));
			}

			this.dateHandler.endDateChanged(date, valid);
		},

		/**
		 * Triggered when changing the start time of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferStartTimeChange: function (oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if (!valid) {
				this.timeModel.setProperty("/StartOfOfferValue", Utils.getFormatDatePiker(date));
			}
			this.dateHandler.startTimeChanged(date, valid);
		},

		/**
		 * Triggered when changing the end time of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferEndTimeChange: function (oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if (!valid) {
				this.timeModel.setProperty("/EndOfOfferValue", Utils.getFormatDatePiker(date));
			}
			this.dateHandler.endTimeChanged(date, valid);
		},

		promptUserForLocationChange: function (newLoc, oldLoc, i18n) {
			return Utils.promptUser({
				i18n: i18n,
				title: "{i18n>CreateOffer.General.LocationChangeDialog.Title}",
				type: "Message",
				state: "Warning",
				text: "{i18n>CreateOffer.General.LocationChangeDialog.Message}",
				ok: "{i18n>CreateOffer.General.LocationChangeDialog.OkBtn}",
				cancel: "{i18n>CreateOffer.General.LocationChangeDialog.CancelBtn}",
				okValue: function () {
					return newLoc;
				},
				cancelValue: function () {
					return oldLoc;
				}
			});
		},
		setDataProvider: function (loader) {
			this.loader = loader;
		},
		handlePromptUserForLocationChange: function (location) {
			var oData = this.dataModel.getData();
			var currentLoc = {
				NodeId: "",
				HierarchyId: oData.HierarchyId,
				ExtNodeId: this.contentModel.getProperty("/ExtNodeId"),
				excludes: oData.ExcludedNodes || []
			};
			
			if(oData.LocationHierarchy && oData.LocationHierarchy.length > 0){
				currentLoc.NodeId = oData.LocationHierarchy[0].NodeId;
			}else{
				currentLoc.NodeId = oData.LocationNodeId;
			}

			var shouldPrompt = (this.getOwnerComponent().getState().getSavePayload().Terms || []).some(function (prod) {
				return prod.ProductId || prod.HierarchyNodeId || prod.HierarchyId;
			}) || !!(oData.Versions || []).length;

			if (shouldPrompt && currentLoc.NodeId && location.NodeId !== currentLoc.NodeId) {
				return this.promptUserForLocationChange(location, currentLoc, this.getView().getModel("i18n"))
					.then(function (location) {
						this.setLocationValue(location);
						this.validateLocation();
						return location;
					}.bind(this), function (location) {
						var locationText = jQuery.sap.formatMessage(location.ExtNodeId, " ", location.HierarchyDescription).trim();
						this.contentModel.setProperty("/LocationText", locationText);
						return null;
					}.bind(this));
			} else {
				this.setLocationValue(location);
				this.validateLocation();
				return Promise.resolve(location);
			}
		},
		setLocationValue: function (location) {
			var excludes = location.excludes;
			var locationText = "";

			if (location.ExtNodeId) {
				locationText = jQuery.sap.formatMessage(location.ExtNodeId, " ", location.HierarchyDescription).trim();
				var oldLoc = this.contentModel.getProperty("/ExtNodeId");
				var locationSubgroups = this.dataModel.getProperty("/LocationSubgroups") || [];
				if (oldLoc !== location.ExtNodeId && locationSubgroups.length) {
					locationSubgroups.forEach(function (loc) {
						loc.Filters = [];
					});
				}
			}
			var sHierarchyId = this.dataModel.getProperty("/HierarchyId");
			if (sHierarchyId !== location.HierarchyId) {
				(locationSubgroups || []).forEach(function (locSubgr) {
					locSubgr.Id = "";
				});
			}
			this.dataModel.setProperty("/LocationNodeId", location.NodeId);
			this.dataModel.setProperty("/LocationFilters", []);
			this.dataModel.setProperty("/ExcludedNodes", []);
			this.dataModel.setProperty("/HierarchyId", location.HierarchyId);
			this.dataModel.setProperty("/ExtHierarchyId", location.ExtHierarchyId);
			this.dataModel.setProperty("/ExtLocationNodeId", location.ExtNodeId);

			this.contentModel.setProperty("/LocationText", locationText);

			var excludedNodes = (excludes || []).map(function (node) {
				return {
					Id: node.NodeId || node.LocationId,
					Type: node.LocationId ? "01" : "04"
				};
			});

			this.dataModel.setProperty("/ExcludedNodes", excludedNodes);
			this.contentModel.setProperty("/ExtNodeId", location.ExtNodeId);

			if (location.hierarchy) {
				this.setLocationDescription(location.hierarchy);
			} else {
				this.updateLocationLabel(location.Cardinality, location.Cardinality);
			}

			this.contentModel.setProperty("/LocationText", locationText);
			return location;
		},

		setLocationDescription: function (hierarchy) {
			var dynamicFilter = new DynamicFilterController(hierarchy);
			var totalStores = dynamicFilter.getStores().length;
			var selectedStores = dynamicFilter.getSelectedStoresCount();

			if (totalStores > 0) {
				this.updateLocationLabel(totalStores, selectedStores);
			} else {
				this.contentModel.setProperty("/LocationStores", "");
			}
		},

		updateLocationLabel: function (totalStores, filteredStores) {
			var locationDescription;
			if (totalStores > 0) {
				if (totalStores === filteredStores) {
					locationDescription = this.i18nModel.getResourceBundle().getText("General.Location.DescriptionSimple", filteredStores);
				} else {
					locationDescription = this.i18nModel.getResourceBundle().getText("General.Location.DescriptionComplex", [filteredStores,
						totalStores
					]);
				}
			} else {
				locationDescription = "";
			}
			this.contentModel.setProperty("/TotalStores", totalStores);
			this.contentModel.setProperty("/LocationStores", locationDescription);
		},

		selectLocation: function (location) {
			if (!location) {
				this.resetLocation();
				this.validateLocation();
				return;
			}
			this.handlePromptUserForLocationChange(location);
		},

		getTacticsMap: function (aTactics, oData) {
			return aTactics.filter(function (oItem) {
				return oItem.Id;
			}).map(function (tactic) {
				if (!tactic.EndTimeOfTacticValue) {
					tactic.EndOfTactic = oData.EndOfOffer;
				}
				if (!tactic.StartTimeOfTacticValue) {
					tactic.StartOfTactic = oData.StartOfOffer;
				}
				return {
					"OfferId": tactic.OfferId || "",
					"TacticType": tactic.TacticType,
					"TacticId": tactic.TacticId,
					"StartOfTactic": tactic.StartOfTactic,
					"EndOfTactic": tactic.EndOfTactic,
					"TacticTypeDesc": tactic.TacticTypeDesc,
					"TacticDesc": tactic.TacticDesc
				};
			});
		},

		getOfferData: function () {
			this.resetCouponData();
			var oData = jQuery.extend({}, this.dataModel.getData());
			deleteUnneededFields(oData);

			// Setting up target groups.
			oData.TargetGroups = (oData.TargetGroups || []).filter(function (oItem) {
				return oItem.Id && oItem.RedeemPercent;
			}).map(function (oItem) {
				if (oItem.hasOwnProperty("Guid")){
				return {
					"Id": oItem.Id,
					"RedeemPercent": oItem.RedeemPercent + "",
					"Name": oItem.Name + "",
					"Description": oItem.Description + "",
					"Members": oItem.Members + 0,
					"MarketingArea": oItem.MarketingArea + "",
					"MarketingAreaDesc": oItem.MarketingAreaDesc + "",
					"Guid": oItem.Guid
					};
				}
				else{
					return {
					"Id": oItem.Id,
					"RedeemPercent": oItem.RedeemPercent + "",
					"Name": oItem.Name + "",
					"Description": oItem.Description + "",
					"Members": oItem.Members + 0,
					"MarketingArea": oItem.MarketingArea + "",
					"MarketingAreaDesc": oItem.MarketingAreaDesc + ""
					};
				}
			});

			oData.Tactics = this.getTacticsMap(oData.Tactics || [], this.dataModel.getData());

			/**
			 * @ControllerHook [ Extend the save payload ]
			 * @callback retail.pmr.promotionaloffers.plugins.general.General~extHookOngetOfferData
			 * @return {void} ...
			 */
			if (this.extHookOngetOfferData) {
				oData = jQuery.extend(oData, this.extHookOngetOfferData());
			}
			delete oData.Terms;
			delete oData.Versions;
			//delete oData.Readonly;
			return oData;
		},

		/**
		 * Changes the time on a specified date.
		 *
		 * @param {object} oDate The date on which to apply the time.
		 * @param {object} oTime The time to apply.
		 * @returns {object} The date with the new time.
		 */
		getDate: function (oDate, oTime) {
			if (!oDate || !oTime) {
				return oDate;
			}
			var oDateResult = new Date(oDate.getTime());
			oDateResult.setHours(oTime.getHours());
			oDateResult.setMinutes(oTime.getMinutes());
			oDateResult.setSeconds(oTime.getSeconds());
			return oDateResult;
		},

		/**
		 * Changes the date to 1 January 1970, but keeps the time.
		 *
		 * @param {object} oDate The date and time on which to reset the date.
		 * @returns {object} The date with the date reseted.
		 */
		getTime: function (oDate) {
			var oResult = new Date(0);
			oResult.setHours(oDate.getHours());
			oResult.setMinutes(oDate.getMinutes());
			oResult.setSeconds(oDate.getSeconds());
			return oResult;
		},

		getTotalAudience: function (aTargetGroup) {
			var sumProjMember = 0;
			if (aTargetGroup.length > 0) {
				aTargetGroup.forEach(function (tg) {
					sumProjMember = sumProjMember + tg.ProjectedMembers;
				});
			}
			return sumProjMember;
		},

		setOfferData: function (data, staticData, featuresAvailable) {
			this.featuresAvailable.setData(featuresAvailable);
			this.contentModel.setProperty("/TacticTypes", staticData.Tactics);
			this.contentModel.setProperty("/ReferenceEvent", data.RefEventId);
			this.contentModel.setProperty("/ReferenceEventText", this.formatRefEventValue(data.RefEventId, data.RefEventName));
			this.contentModel.setProperty("/LocationStores", "");
			this.contentModel.setProperty("/Hierarchy", "");

			data.StartOfOffer = new Date(data.StartOfOffer);
			data.EndOfOffer = new Date(data.EndOfOffer);
			var oStartTime = this.getTime(data.StartOfOffer);
			var oEndTime = this.getTime(data.EndOfOffer);
			this.timeModel.setData({
				Selected: Utils.isAllDay(data.StartOfOffer, data.EndOfOffer),
				StartTime: oStartTime,
				EndTime: oEndTime,
				PreviousStartOfOffer: data.StartOfOffer,
				PreviousEndTime: oEndTime,
				ValidStartOfOffer: data.StartOfOffer ? true : false,
				ValidEndOfOffer: data.EndOfOffer ? true : false
			});

			this.dateHandler.setStartDate(data.StartOfOffer);
			this.dateHandler.setEndDate(data.EndOfOffer);
			this.dateHandler.setStartTime(oStartTime);
			this.dateHandler.setEndTime(oEndTime);
			this.dateHandler.setPrevStartDate(data.StartOfOffer);
			this.dateHandler.setPrevEndDate(data.EndOfOffer);
			this.dateHandler.setPrevStartTime(oStartTime);
			this.dateHandler.setPrevEndTime(oEndTime);

			this.setWeekForStartOfOffer(data.StartOfOffer);
			this.setWeekForEndOfOffer(data.EndOfOffer);

			if (data.Tactics.length) {
				data.Tactics.forEach(function (oTactic) {
					oTactic.Id = oTactic.TacticType + "/" + oTactic.TacticId;
					oTactic.Name = oTactic.TacticTypeDesc + "/" + oTactic.TacticDesc;
					oTactic.OfferId = oTactic.OfferId || "";
					oTactic.StartOfTactic = oTactic.StartOfTactic ? oTactic.StartOfTactic : data.StartOfOffer;
					oTactic.EndOfTactic = oTactic.EndOfTactic ? oTactic.EndOfTactic : data.EndOfOffer;
					oTactic.StartTimeOfTactic = this.getTime(oTactic.StartOfTactic);
					oTactic.EndTimeOfTactic = this.getTime(oTactic.EndOfTactic);
					oTactic.EndTimeOfTacticValue = this.timeLabelValueFormatter(oTactic.EndTimeOfTactic);
					oTactic.StartTimeOfTacticValue = this.timeLabelValueFormatter(oTactic.StartOfTactic);
				}.bind(this));
			} else {
				data.Tactics.push({
					"Id": null,
					"Name": null,
					"StartOfTactic": data.StartOfOffer,
					"EndOfTactic": data.EndOfOffer,
					"StartTimeOfTactic": oStartTime,
					"EndTimeOfTactic": oEndTime,
					"EndTimeOfTacticValue": this.timeLabelValueFormatter(oEndTime),
					"StartTimeOfTacticValue": this.timeLabelValueFormatter(oStartTime)
				});
			}

			if (data.TargetGroups && data.TargetGroups.length) {
				data.TargetGroups = data.TargetGroups.map(function (oItem) {
					oItem.ProjectedMembers = Math.round(parseFloat(oItem.RedeemPercent) / 100 * oItem.Members);
					return oItem;
				});
				var nTotalAudience = this.getTotalAudience(data.TargetGroups);
				this.contentModel.setProperty("/TotalAudience", nTotalAudience);
			}
			var selectedStatus = data.Status;
			var foundStatus = staticData.Statuses.filter(function (status) {
				return status.Key === selectedStatus;
			});
			if (!foundStatus || (foundStatus && foundStatus.length < 1)) {
				staticData.Statuses.unshift({
					Key: data.Status,
					Value: data.StatusName
				});
			}

			this.contentModel.setProperty("/Statuses", staticData.Statuses);
			this.contentModel.setProperty("/OfferSetValue", data.OfferSetName);
			this.contentModel.setProperty("/Editable", !data.Readonly);
			this.getView().byId("generalStatus").setSelectedKey(data.Status);
			if (Utils.isEditableHeader({
					Status: data.Status,
					UIState: data.UIState
				})) {
				this.contentModel.setProperty("/Editable", false);
			}
			this.dataModel.setData(data);
			this.contentModel.setProperty("/LocationText", data.ExtLocationNodeId);

			if (data.LocationHierarchy.length) {
				var totalStores = Utils.storeCount(data.LocationHierarchy);
				var numberOfExcludedNodes = data.ExcludedNodes ? data.ExcludedNodes.length : 0;
				var selectedStores = totalStores - numberOfExcludedNodes;
				this.updateLocationLabel(totalStores, selectedStores);
			}

			this.contentModel.setProperty("/ExtNodeId", data.ExtLocationNodeId);

			if (this.getView().getModel("UIVisiblity").getProperty("/Version") > 2 && !this.oMarketingArea.getBinding("items")) {
				this.contentModel.setProperty("/MarketingAreaFilter", {
					MarketingArea: this.dataModel.getProperty("/MarketingArea")
				});
				var oItemTemplate = new sap.ui.core.Item({
					key: "{MKT_AREA_ID}",
					text: {
						parts: [{
							path: "MKT_AREA_DESC"
						}, {
							path: "MKT_AREA_ID"
						}],
						formatter: retail.pmr.promotionaloffers.utils.Formatter.marketingArea
					}
				});
				this.oMarketingArea.setModel(Models.getServiceModel());
				this.oMarketingArea.setModel(this.dataModel, "Data");
				this.oMarketingArea.bindItems("/SH_H_DMF_MKT_AREA_H", oItemTemplate);
			}

			this.setMasterDataSystemDependentCombos(data.MasterdataSystem);

			/**
			 * @ControllerHook [ Set your custom fields in the UI (opposite of extHookOnsetOfferData) ]
			 * @callback retail.pmr.promotionaloffers.plugins.general.General~extHookOnsetOfferData
			 * @param {object} data The offer data
			 * @param {object} staticData The static data
			 * @return {void}
			 */
			if (this.extHookOnsetOfferData) {
				this.extHookOnsetOfferData(data, staticData);
			}
		},
		resetOfferData: function () {
			this.contentModel.setData({});
			this.dataModel.setData({});
			this.timeModel.setData({});
		},
		resetMarketingArea: function () {
			var marketingArea = "";
			this.dataModel.setProperty("/MarketingArea", marketingArea);
			this.contentModel.setProperty("/MarketingAreaFilter", {
				MarketingArea: marketingArea
			});
			var targetGroups = (this.dataModel.getProperty("/TargetGroups") || []).filter(function (targetGroup) {
				return targetGroup.MarketingArea === marketingArea;
			});
			this.dataModel.setProperty("/TargetGroups", targetGroups);
		},

		openLeadingCategoryDialog: function () {
			TreeValueHelpDialog.openDialog({
				tableFragment: "retail.pmr.promotionaloffers.plugins.general.LeadingCategoryComplexSearch",
				title: "{i18n>CreateOffer.General.LeadingCategory}",
				filterProps: ["ExtId", "Name", "HierarchyDescription", "ExtHierarchyId"],
				values: Utils.buildHierarchy(this.contentModel.getData().LeadingCategoriesSet, "LeadingCategory")
			}).then(function (selection) {
				if (!selection) {
					this.dataModel.setProperty("/LeadingCategory", null);
					this.dataModel.setProperty("/LeadingCategoryName", "");
					return;
				}
				this.dataModel.setProperty("/LeadingCategory", selection.Id);
				this.dataModel.setProperty("/LeadingCategoryName", jQuery.sap.formatMessage(selection.ExtId, " ", selection.Name));
				this.validateLeadingCategory();
			}.bind(this));
		},

		handleLeagingCategoryComplexSearch: function () {
			var leadingCategories = this.contentModel.getProperty("/LeadingCategoriesSet") || [];
			if (!leadingCategories.length) {
				var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
				this.setLeadingCategory(masterdataSystem).then(function () {
					this.openLeadingCategoryDialog();
				}.bind(this));
				return;
			}
			this.openLeadingCategoryDialog();
		},

		typeSearchLocationPicker: function (oEvent, oCtrl) {
			var that = oEvent.getSource();
			var suggestedValue = oEvent.getParameter("suggestValue");
			var masterdataSystem = oCtrl.dataModel.getProperty("/MasterdataSystem");
			var multiKey = oEvent.getSource().searchKey;
			var propertyName = null;
			if (multiKey === "DistributionChannel") {
				propertyName = "DistChannel";
			} else {
				propertyName = "SalesOrg";
			}

			if (propertyName) {
				Models.getSearchHelpLocationPicker(masterdataSystem, propertyName, suggestedValue).then(function (returnData) {

					that.destroySuggestionItems();
					var len = returnData.data.length > 10 ? 10 : returnData.data.length;

					for (var q = 0; q < len; q++) {
						var suggestionItem = new ListItem({
							text: returnData.data[q].Key,
							key: returnData.data[q].Key,
							additionalText: returnData.data[q].Value
						});
						that.addSuggestionItem(suggestionItem);
					}
				});
			}
		},
		getFilterBarSettings: function (ranges, title) {
			var nameSettings = {
				valueHelpRequest: function () {
					var that = this;
					var supportedRanges = [
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.Contains,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.BT,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EQ,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EndsWith,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.GE,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.GT,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.LE,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.LT,
						sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.StartsWith
					];

					var valueHelpName = new sap.ui.comp.valuehelpdialog.ValueHelpDialog({
						supportMultiselect: true,
						supportRanges: true,
						supportRangesOnly: true,
						title: title,
						ok: function (oControlEvent) {
							that.setTokens(oControlEvent.getParameters().tokens);
							valueHelpName.close();
						},
						cancel: function () {
							valueHelpName.close();
						},
						afterClose: function () {
							valueHelpName.destroy();
						}
					});

					valueHelpName.setIncludeRangeOperations(supportedRanges);
					valueHelpName.setRangeKeyFields(ranges);
					valueHelpName.setTokens(that.getTokens());
					valueHelpName.open();
				}
			};

			return nameSettings;
		},
		getFiltersFromTokens: function (searchFilters, filterArry, index) {
			for (var tokenIndex = 0, tokensLen = searchFilters[index].getTokens().length; tokenIndex < tokensLen; tokenIndex++) {
				var cItem = {};
				if (searchFilters[index].getTokens()[tokenIndex].getAggregation("customData").length > 0) {
					var tokenValue = searchFilters[index].getTokens()[tokenIndex].getAggregation("customData")[0].getProperty("value");
					cItem.key = tokenValue.keyField;
					cItem.exclude = tokenValue.exclude;
					cItem.operator = tokenValue.operation;
					cItem.value1 = tokenValue.value1;
					cItem.value2 = tokenValue.value2;

				} else {
					cItem.key = searchFilters[index].searchKey;
					cItem.operator = "EQ";
					cItem.exclude = false;
					cItem.value1 = searchFilters[index].getTokens()[tokenIndex].getKey();
					cItem.value2 = "";
				}
				filterArry.push(cItem);
			}
		},
		setSelectedHierarchy: function (item, excludes, hierarchy) {
			var that = this;

			function _setHierarchy(nodeID, hierarchyID, excludes, externalID, hierarchy) {
				var location = {
					NodeId: nodeID,
					HierarchyId: hierarchyID,
					ExtNodeId: externalID,
					excludes: excludes,
					hierarchy: hierarchy
				};
				that.handlePromptUserForLocationChange(location);

			}

			function _setEmpty() {
				that.contentModel.setProperty("/LocationText", "");
			}

			if (item) {
				var nodeID = item.NodeId ? item.NodeId : item.LocationId;
				var externalID = item.ExtNodeId ? item.ExtNodeId : item.ExtLocationId;
				_setHierarchy(nodeID, item.HierarchyId, excludes, externalID, hierarchy);
			} else {
				_setHierarchy(null, null, null, null);
				_setEmpty();
			}

			this.validateLocation();
		},
		onLocationSuggest: function (e) {
			var suggestValue = e.getParameter("suggestValue");
			var input = e.getSource();
			var masterDataSystem = this.dataModel.getProperty("/MasterdataSystem");
			input.destroySuggestionItems();
			this.bLocSuggestSelect = false;

			Models.getLocationSuggestions(masterDataSystem, suggestValue).then(function (aData) {
				input.setFilterFunction(function () {
					return true;
				});
				aData.data.map(function (location) {
					var item = new ListItem({
						key: location.ExtNodeId,
						text: location.ExtNodeId || "",
						additionalText: location.ExtHierarchyId || ""
					});

					item.data = location;
					return item;
				}).forEach(input.addSuggestionItem, input);

			});
		},
		
		resetLocation: function() {
			this.dataModel.setProperty("/LocationNodeId", null);
			this.dataModel.setProperty("/HierarchyId", null);
			this.dataModel.setProperty("/ExcludedNodes", []);
			this.dataModel.setProperty("/LocationFilters", []);
			this.contentModel.setProperty("/ExtNodeId", null);
			this.contentModel.setProperty("/LocationStores", "");
		//	this.contentModel.setProperty("/LocationText", null);
		},

		/**
		 * Fired when the value from the location input is changed.
		 * Checks if the entered value is a valid location.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onLocationChange: function (oEvent) {
			if (this.bLocSuggestSelect) {
				this.bLocSuggestSelect = false;
				return;
			}
			var sValue = oEvent.getSource().getValue();
			if (!sValue) {
				this.selectLocation(null);
				this.updateLocationLabel(0);
				return;
			}
			var filter = "ExtNodeId eq '" + sValue.toUpperCase() + "'";
			this.setLocationHierarchy(filter);
		},

		setLocationHierarchy: function (filter, extNodeId) {
			var sMasterDataSystem = this.dataModel.getProperty("/MasterdataSystem");

			return Models.getLocationFiltered(sMasterDataSystem, filter, null, true).then(function (oData) {
				if (oData.data.length) {
					var data = extNodeId ? oData.data.filter(function (loc) {
						return loc.ExtNodeId === extNodeId;
					}) : oData.data;
					if (location) {}
					this.handlePromptUserForLocationChange(data[0]).then(function (result) {
						if (result) {
							this.updateLocationHierarchyOnDateChange(oData);
						}
					}.bind(this));
					this.resetFilters();
				} else {
					this.resetLocation();
					this.validateLocation();
				}
			}.bind(this));

		},
		
		/**
		 * Open value help dialog when input help button is pressed.
		 *
		 * @returns {void}
		 */
		handleLocationComplexSearch: function () {
			// Check for filters
			var locationFilters = this.dataModel.getProperty("/LocationFilters") || [];
			var that = this;
			var hasFiltersFromAdvanced = locationFilters.filter(function (loc) {
				return loc.Sign === "I" || loc.Field !== "ExtLocationId";
			});

			if (!hasFiltersFromAdvanced.length) {
				that.openLocationComplexSearch.call(that);
			} else {
				promptUserManualExclusionSwitch(that.getView().getModel("i18n"), function () {
					that.openLocationComplexSearch.call(that);
				}.bind(this), Utils.identity);
			}

		},

		/**
		 * Fired when location input help button is pressed.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		openLocationComplexSearch: function () {
			function ignoreFilter() {
				return true;
			}
			var that = this;
			var i18nBundle = this.i18nModel.getResourceBundle();

			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.general.LocationTree", that);
			that.getView().addDependent(table);

			var selector = new LocationSelector(table);
			this.oLocationSelector = selector;
			table.expandToLevel(0);
			table.attachToggleOpenState(function (e) {
				var params = {
					rowContext: e.getParameter("rowContext"),
					expanded: e.getParameter("expanded")
				};
				selector.asyncExpand(params);
			});

			var settingValueHelpDialog = {
				title: this.i18nModel.getResourceBundle().getText("CreateOffer.General.Location"),
				supportMultiselect: true,
				stretch: sap.ui.Device.system.phone,
				ok: function () {
					that.dataModel.setProperty("/LocationFilters", []);
					var selections = selector.getSelection();
					var includeNode = selections.selection;
					var excludedNodes = selections.exclusions;
					var self = this;
					var versions = that.dataModel.getData().Versions;
					var localNodes = that.dataModel.getProperty("/LocalNodes");
					promptForVersionsOnExcluded(versions, localNodes, excludedNodes).then(function () {

						that.setSelectedHierarchy(includeNode, excludedNodes, includeNode);
						that.removeBadVersionsOnExcluded(that.dataModel, excludedNodes);
						var isOnlyExclude = false;
						var data = that.dataModel.getData();
						if (data.LocationHierarchy && data.LocationHierarchy.length > 0) {
							if (includeNode && includeNode.HierarchyId === data.LocationHierarchy[0].HierarchyId) {
								isOnlyExclude = true;
							}
						}
						that.contentModel.setProperty("/Hierarchy", includeNode);
						that.eventBus.publish("retail.pmr.promotionaloffers", "setLocationSelection", {
							includeNode: includeNode,
							excludedNodes: excludedNodes,
							hierarchy: includeNode,
							isOnlyExclude: isOnlyExclude
						});
						self.close();
						that._locationPickerDialog.destroy();
					}.bind(this), Utils.identity);
				},
				cancel: function () {
					this.close();
					that._locationPickerDialog.destroy();
				},
				selectionChange: function (e) {
					var rowObj = e.getParameter("tableSelectionParams").rowContext.getObject();
					if (rowObj.needsExpand) {
						that.getHierarchy(rowObj);
					}
					selector.selectionChanged(e, true);
				}
			};
			that._locationPickerDialog = new ValueHelpDialogTokenizer("locationPickerID", settingValueHelpDialog);
			///######### tree table

			that._locationPickerDialog.setTable(table);

			///############

			//%%%%%%%%% FILTER BAR

			var filterItems = [];

			var definedFilters = [{
				label: i18nBundle.getText("General.Location.NodeId"),
				key: "ExtNodeId"
			}, {
				label: i18nBundle.getText("General.Location.NodeName"),
				key: "Location"
			}, {
				label: i18nBundle.getText("General.Location.DistributionChannel"),
				key: "DistributionChannel"
			}, {
				label: i18nBundle.getText("General.Location.SalesOrg"),
				key: "SalesOrg"
			}];

			for (var t = 0; t < definedFilters.length; t++) {
				var item = new sap.m.MultiInput(that.getFilterBarSettings([{
					label: definedFilters[t].label,
					key: definedFilters[t].key
				}], definedFilters[t].label));
				//fix to show the suggestion popup
				item.setFilterFunction(ignoreFilter);

				if (definedFilters[t].key === "SalesOrg" || definedFilters[t].key === "DistributionChannel") {
					item.attachEvent("suggest", that, this.typeSearchLocationPicker);
				}

				item.searchKey = definedFilters[t].key;
				var filterItem = new sap.ui.comp.filterbar.FilterItem({
					control: item,
					name: definedFilters[t].label,
					partOfCurrentVariant: true,
					label: definedFilters[t].label
				});

				filterItems.push(filterItem);
			}

			var oFilterBar = new sap.ui.comp.filterbar.FilterBar({
				advancedMode: true,
				filterBarExpanded: true,
				showGoOnFB: true,
				filterItems: filterItems,
				persistencyKey: "filterBarKey",
				beforeVariantSave: function () {},
				afterVariantLoad: function () {},
				search: function (event) {
					that._locationPickerDialog.getTable().setBusy(true);
					var filters = Utils.calculateFilters(event);
					var flatenFilters = Utils.flatenFilters(filters);
					var masterDataSystem = that.dataModel.getProperty("/MasterdataSystem");

					//backend call/apply filters/apply search param

					var basicSearchValue = Utils.setBasicSearchValue.call(that, "_locationPickerDialog");
					var expand = event.getParameter("expand");
					var bShoudExpand = !!expand && !that.oCachedHierarchies[expand];
					Models.getLocationFiltered(masterDataSystem, flatenFilters, basicSearchValue, bShoudExpand).then(function (aData) {
						that.lastSeachLocationData = jQuery.extend(true, [], aData.data);
						if (bShoudExpand) {
							that.cacheLocations(expand, aData.data);
						}
						var locationsSet = that.getHierarchiesWithCache(aData.data);

						var dataModel = that.dataModel.getData();
						var exclude = dataModel.ExcludedNodes;
						var locId = dataModel.LocationNodeId;

						if (selector.selector) {
							var selections = selector.getSelection();
							locId = selections.selection ? selections.selection.NodeId : locId;
							exclude = (!selections.selection) ? exclude : selections.exclusions;
						}

						var includeExclude = {
							ID: locId,
							ExcludeNodes: exclude
						};
						selector.passVHDialog(that._locationPickerDialog, i18nBundle.getText("General.LocationHierarchy.NoData"));
						selector.setData(includeExclude, locationsSet, {
							StartOfOffer: dataModel.StartOfOffer.getTime(),
							EndOfOffer: dataModel.EndOfOffer.getTime()
						});

						table.setBusy(false);
						that.eventBus.publish("retail.pmr.promotionaloffers", "setLocationData", {
							locationSet: locationsSet
						});
					});
				}
			});

			var basicSearchField = new sap.m.SearchField({
				showSearchButton: sap.ui.Device.system.phone,
				placeholder: i18nBundle.getText("General.Location.Picker.Placeholder")
			});

			if (oFilterBar.setBasicSearch) {
				oFilterBar.setBasicSearch(basicSearchField);
			}

			oFilterBar.setSearchEnabled(true);
			that._locationPickerDialog.setFilterBar(oFilterBar);
			that._locationPickerDialog.addStyleClass("sapUiSizeCompact");
			that._locationPickerDialog.open();

			if (that.getView().byId("generalLocation").getValue().length > 0 && that.dataModel.getData().LocationNodeId) {
				var searchValue = that.contentModel.getProperty("/ExtNodeId") || "";
				that._locationPickerDialog.setBasicSearchText(searchValue);
				oFilterBar.fireSearch({
					expand: that.dataModel.getProperty("/HierarchyId")
				});
			}
		},

		findChildrenForLeadingCategory: function (parent, children) {
			if (parent) {
				if (children[parent.Id]) {
					parent.children = children[parent.Id];
					for (var i = 0, len = parent.children.length; i < len; ++i) {
						this.findChildrenForLeadingCategory(parent.children[i], children);
					}
				}
			}
		},
		findChildrenForLocation: function (parent, children) {
			if (parent) {
				if (children[parent.NodeId]) {
					parent.children = children[parent.NodeId];
					for (var i = 0, len = parent.children.length; i < len; ++i) {
						this.findChildrenForLocation(parent.children[i], children);
					}
				}
			}
		},

		cacheLocations: function (hierarchyId, data) {
			if (!this.oCachedHierarchies[hierarchyId]) {
				this.oCachedHierarchies[hierarchyId] = {};
			}
			data.forEach(function (node) {
				this.oCachedHierarchies[hierarchyId][node.NodeId] = node;
			}.bind(this));
		},

		getHierarchiesWithCache: function (locationsSet) {
			return jQuery.extend(true, [], locationsSet).map(function (hierarchy) {
				if (this.oCachedHierarchies[hierarchy.HierarchyId]) {
					hierarchy.Locations = jQuery.extend(true, [], this.oCachedHierarchies[hierarchy.HierarchyId][hierarchy.NodeId].Locations);
				} else if (parseInt(hierarchy.Cardinality, 10) > 0) {
					hierarchy.Locations.results = [{}];
					hierarchy.needsExpand = true;
				}
				return hierarchy;
			}.bind(this));
		},

		getHierarchy: function (obj, expand) {

			var filter = "HierarchyId eq '" + obj.HierarchyId + "'";
			var masterDataSystem = this.dataModel.getProperty("/MasterdataSystem");
			var table = this._locationPickerDialog.getTable();
			var i18nBundle = this.i18nModel.getResourceBundle();
			var dataModel = this.dataModel.getData();

			table.setShowOverlay(true);
			Models.getLocationFiltered(masterDataSystem, filter, "", true).then(function (aData) {
				if (aData.data && aData.data.length) {
					this.cacheLocations(obj.HierarchyId, aData.data);

				}
				var locationsSet = this.getHierarchiesWithCache(this.lastSeachLocationData);

				this.oLocationSelector.passVHDialog(this._locationPickerDialog, i18nBundle.getText("General.LocationHierarchy.NoData"));
				var selections = this.oLocationSelector.getSelection();

				var locId = selections.selection ? selections.selection.NodeId : "";
				var includeExclude = {
					ID: locId,
					ExcludeNodes: selections.exclusions
				};

				this.oLocationSelector.setData(includeExclude, locationsSet, {
					StartOfOffer: dataModel.StartOfOffer.getTime(),
					EndOfOffer: dataModel.EndOfOffer.getTime()
				});

				table.setShowOverlay(false);
				var data = this.oLocationSelector.treeModel.getData();

				//hierachy index
				for (var i = 0, iLen = data.length; i < iLen; i++) {
					if (obj.HierarchyId === data[i].HierarchyId) {
						break;
					}
				}
				if (expand) {
					data[i].expanding = true;
					this.oLocationSelector.renderExpand(table, this.oLocationSelector.treeModel, obj);
				}

				table.setFirstVisibleRow(i);
			}.bind(this));
		},

		locationToggle: function (oEvent) {
			var obj = oEvent.getParameter("rowContext").getObject();
			if (this.oCachedHierarchies[obj.HierarchyId]) {
				return;
			}
			this.getHierarchy(obj, oEvent.getParameter("expanded"));
		},

		/**
		 * Fired when location suggestion is selected.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		locationSuggestionItemSelected: function (oEvent) {
			var item = oEvent.getParameter("selectedItem");
			if (!item) {
				return;
			}
			var location = item.data;
			this.bLocSuggestSelect = true;

			var filter = "HierarchyId eq '" + location.HierarchyId + "'";
			this.setLocationHierarchy(filter, location.ExtNodeId);
		},

		/**
		 * Fired when a suggestion item is selected for the leading category input.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onLeadingCategorySuggestionSelect: function (oEvent) {
			var oSelectedItem = oEvent.getParameters("selectedItem").selectedItem;
			var sId = oSelectedItem.getProperty("key");
			var sText = oSelectedItem.getProperty("text");
			this.dataModel.setProperty("/LeadingCategory", sId);
			this.dataModel.setProperty("/LeadingCategoryName", sText);
			this.validateLeadingCategory();
		},

		onLeadingCategorySuggest: function (oEvent) {
			var leadingCategories = this.contentModel.getProperty("/LeadingCategoriesSet") || [];
			if (leadingCategories.length || this.contentModel.getProperty("/LeadingCategoryBusy")) {
				return;
			}
			var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
			this.setLeadingCategory(masterdataSystem).then(function () {
				this.validateLeadingCategory();
			}.bind(this));
		},

		/**
		 * Fired when the leading category input value is changed.
		 * If the entered value is a valid leading category it automatically selects it.
		 * At the end it fires up the form validation.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		leadingCategoryValueChanged: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			this.dataModel.setProperty("/LeadingCategory", "");

			if (!sValue) {
				this.validateLeadingCategory();
				return;
			}

			function updateLC() {
				var aLeadingCategories = this.contentModel.getProperty("/LeadingCategoriesSet") || [];
				for (var i = 0; i < aLeadingCategories.length; i++) {
					var oLeadingCategory = aLeadingCategories[i];
					if (oLeadingCategory.ExtId === sValue.toUpperCase()) {
						this.dataModel.setProperty("/LeadingCategory", oLeadingCategory.Id);
						this.dataModel.setProperty("/LeadingCategoryName", jQuery.sap.formatMessage(oLeadingCategory.ExtId, " ", oLeadingCategory.Name));
					}
				}
				this.validateLeadingCategory();
			}

			if (!(this.contentModel.getProperty("/LeadingCategoriesSet") || []).length) {
				var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
				this.setLeadingCategory(masterdataSystem).then(function () {
					updateLC.call(this);
				}.bind(this));
				return;
			}
			updateLC.call(this);
		},

		/**
		 * Fired when pressing search in reference event dialog.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		_handleReferenceEventDialogSearch: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new Filter(
				"Name",
				sap.ui.model.FilterOperator.Contains, sValue
			);
			oEvent.getSource().getBinding("items").filter([oFilter]);
		},

		/**
		 * Fired when the target group name input is changed. It automatically selects the item
		 * from suggestion that matches with the text typed in the input. Validation is implemented.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onTargetGroupChange: function (oEvent) {
			if (oEvent.skipChange && oEvent.valueInput) {
				// set the value from valuehelpdialog event
				oEvent.getSource().setValue(oEvent.valueInput);
				// skip in case this is called after selectioning from valuehelpdialog
				return;
			}
			var sText = oEvent.getSource().getValue();
			var sPath = oEvent.getSource().getParent().getBindingContext().getPath();
			var oRowData = null;

			// If there is no text, the row must be empty.
			if (!sText) {
				oRowData = jQuery.extend(true, {}, this.CONSTANTS.TARGET_GROUP_EMPTY_ROW);
				this.dataModel.setProperty(sPath, oRowData);
				this.validateTargetGroups();
				return;
			}

			// Gets an empty a row.
			var getEmptyRow = function () {
				return jQuery.extend(true, {}, this.CONSTANTS.TARGET_GROUP_EMPTY_ROW, {
					"Name": sText,
					"RedeemEnabled": false
				});
			}.bind(this);

			// Checking if the entered text is a valid target group name.
			Models.getTargetGroups("equals", sText).then(function (oData) {
				if (oData.TargetGroups.length) {
					oRowData = oData.TargetGroups[0];
					if (oRowData.RedeemPercent === 0) {
						oRowData.RedeemPercent = "100";
					}
					jQuery.extend(oRowData, {
						"ProjectedMembers": Math.round(parseFloat(oRowData.RedeemPercent) / 100 * oRowData.Members),
						"RedeemEnabled": true
					});
					this.dataModel.setProperty(sPath, oRowData);
				} else {
					this.dataModel.setProperty(sPath, getEmptyRow());
				}
				this.validateTargetGroups();
			}.bind(this), function () {
				this.dataModel.setProperty(sPath, getEmptyRow());
				this.validateTargetGroups();
			}.bind(this));
		},

		/**
		 * Fired when the target group reedem percent input is changed to update the project members.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onRedeemPercentChange: function (oEvent) {
			var iRedeemPercent = parseFloat(oEvent.getSource().getValue());
			var sPath = oEvent.getSource().getParent().getBindingContext().getPath();

			var iProjectedMembers = null;
			if (iRedeemPercent >= 1 && iRedeemPercent <= 100) {
				var iMembers = this.dataModel.getProperty(sPath + "/Members");
				iProjectedMembers = Math.round(iRedeemPercent / 100 * iMembers);
			}

			this.dataModel.setProperty(sPath + "/ProjectedMembers", iProjectedMembers);
			this.validateTargetGroups();
		},
		/**
		 * Fired when a suggestion item is selected.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onTargetGroupSuggestionSelect: function (oEvent) {
			var oData = this.getModelDataFromAnnotation(oEvent);
			var iProjectedMembers = Math.round(parseFloat(oData.RedeemPercent) / 100 * parseFloat(oData.Members));
			var sPath = oEvent.getSource().getParent().getBindingContext().getPath();
			oData = jQuery.extend(true, {}, oData, {
				"ProjectedMembers": iProjectedMembers,
				"RedeemEnabled": true
			});
			var versionCheck = this.getView().getModel("UIVisiblity").getProperty("/Version") > 2;
			if (versionCheck && !this.dataModel.getProperty("/MarketingArea")) {
				this.dataModel.setProperty("/MarketingArea", oData.MarketingArea);
				this.contentModel.setProperty("/MarketingAreaFilter", {
					MarketingArea: oData.MarketingArea
				});
			}
			this.dataModel.setProperty(sPath, oData, null, true);
			// set the value that will be passed to the input
			oEvent.valueInput = oData.Name;
			// set flag that it needs to skip the change event on the input
			oEvent.skipChange = true;
			this.validateTargetGroups();

			return oEvent;
		},

		/**
		 * Fired when add button is pressed to add a new line to the target group table.
		 *
		 * @returns {void}
		 */
		handleAddTargetGroupPress: function () {
			var aTargetGroups = this.dataModel.getData().TargetGroups;
			var oNewRow = jQuery.extend(true, {}, this.CONSTANTS.TARGET_GROUP_EMPTY_ROW);
			oNewRow.Id = null;
			oNewRow.Name = null;
			aTargetGroups.push(oNewRow);
			this.dataModel.updateBindings();
		},

		/**
		 * Fired when delete button is pressed to remove a line from the target group table.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		handleDeleteTargetGroup: function (oEvent) {
			var sPath = oEvent.getParameter("listItem").getBindingContext().getPath();
			var aTemp = sPath.split("/");
			var iRowIndex = aTemp[aTemp.length - 1];
			var aTargetGroups = this.dataModel.getData().TargetGroups;
			aTargetGroups.splice(iRowIndex, 1);
			this.dataModel.updateBindings();
			this.validateTargetGroups();
		},

		/**
		 * Validation for target groups.
		 *
		 * @returns {boolean} True if there is at least one error, false otherwise.
		 */
		validateTargetGroups: function () {
			var aTargetGroups = this.dataModel.getProperty("/TargetGroups");
			var i18nBundle = this.i18nModel.getResourceBundle();
			var sInvalidTargetGroupError = i18nBundle.getText("CreateOffer.General.TargetGroup.Invalid");
			var sInvalidRedeemPercentError = i18nBundle.getText("CreateOffer.General.TargetGroup.InvalidRedeemPercent");
			var sDuplicatedTargetGroupsError = i18nBundle.getText("CreateOffer.General.TargetGroup.Duplicate");

			Utils.removeMessagesByPath("/TargetGroups");

			var aErrorMessages = [];
			var setErrorMessage = function (sTarget, sTitle, sDescription) {
				aErrorMessages.push(new sap.ui.core.message.Message({
					message: sTitle,
					description: sDescription,
					type: "Error",
					target: sTarget,
					processor: this.dataModel
				}));
			}.bind(this);

			var skipRowFn = function (oTargetGroup) {
				return !oTargetGroup.Name;
			};

			var validateRedeemPercentFn = function (oTargetGroup, iTacticIndex) {
				if (parseFloat(oTargetGroup.RedeemPercent) < 1 || parseFloat(oTargetGroup.RedeemPercent) > 100) {
					var sTarget = "/TargetGroups/" + iTacticIndex + "/RedeemPercent";
					var sErrorDescription = i18nBundle.getText("CreateOffer.General.TargetGroup.InvalidRedeemPercentRow", iTacticIndex + 1);
					setErrorMessage(sTarget, sInvalidRedeemPercentError, sErrorDescription);
				}
			};

			var validateTargetGroupFn = function (oTargetGroup, iTacticIndex) {
				if (!oTargetGroup.Id) {
					var sTarget = "/TargetGroups/" + iTacticIndex + "/Name";
					var sErrorDescription = i18nBundle.getText("CreateOffer.General.TargetGroup.InvalidRow", iTacticIndex + 1);
					setErrorMessage(sTarget, sInvalidTargetGroupError, sErrorDescription);
				}
			};

			var validateDuplicatedTargetGroups = function (aTargetGroups) {
				var oFrequency = {};
				aTargetGroups.forEach(function (oTargetGroup, iIndex) {
					if (!oTargetGroup.Id) {
						return;
					}
					if (typeof oFrequency[oTargetGroup.Id] === "undefined") {
						oFrequency[oTargetGroup.Id] = [];
					}
					oTargetGroup.index = iIndex;
					oFrequency[oTargetGroup.Id].push(oTargetGroup);
				});
				for (var sKey in oFrequency) {
					if (oFrequency[sKey].length > 1) {
						oFrequency[sKey].forEach(function (oItem) {
							setErrorMessage("/TargetGroups/" + oItem.index + "/Name", sDuplicatedTargetGroupsError, "");
						});
					}
				}
			};

			this.validateTable(aTargetGroups, {
				validations: [validateDuplicatedTargetGroups],
				iterationValidations: [validateTargetGroupFn, validateRedeemPercentFn],
				skipRowFn: skipRowFn
			});

			this.oMessageManager.addMessages(aErrorMessages);
			// update total audience
			if (aErrorMessages.length === 0) {
				var nTotalAudience = this.getTotalAudience(aTargetGroups);
				this.contentModel.setProperty("/TotalAudience", nTotalAudience);
			}

			return aErrorMessages.length;
		},

		setTacticTypeInfo: function (sPath, oData, oModel) {
			var row = oModel.getProperty(sPath);
			row = jQuery.extend(row, oData);
			oModel.setProperty(sPath, row, null, true);
		},

		onTacticSuggestionSelect: function (oEvent) {
			var oSelectedItem = this.getModelDataFromAnnotation(oEvent);

			var sId = oSelectedItem.TacticAndType;
			var sText = oSelectedItem.TacticAndTypeDesc;
			var sRowPath = oEvent.getSource().getParent().getBindingContextPath();
			this.dataModel.setProperty(sRowPath + "/Id", sId, null, true);
			this.dataModel.setProperty(sRowPath + "/Name", sText, null, true);

			this.setTacticTypeInfo(sRowPath, oSelectedItem, this.dataModel);

			this.validateTactics();
		},

		/**
		 * Fired when add button is pressed to add a new line to the tactics table.
		 *
		 * @returns {void}
		 */
		handleAddTacticsPress: function () {
			this.addNewTactic();
			this.validateTactics();
		},

		addNewTactic: function (id, name) {
			var aTactics = this.dataModel.getData().Tactics;
			var oStartDate = this.dataModel.getProperty("/StartOfOffer");
			var oEndDate = this.dataModel.getProperty("/EndOfOffer");
			var oTime = this.timeModel.getData();

			var tactic = {
				"Id": id || null,
				"Name": name || null,
				"StartOfTactic": oStartDate,
				"EndOfTactic": oEndDate,
				"StartTimeOfTactic": oTime.StartTime,
				"EndTimeOfTactic": oTime.EndTime,
				"EndTimeOfTacticValue": this.timeLabelValueFormatter(oTime.EndTime),
				"StartTimeOfTacticValue": this.timeLabelValueFormatter(oTime.StartTime)
			};

			aTactics.push(tactic);
			this.dataModel.refresh();
			return tactic;
		},

		/**
		 * Fired when delete button is pressed. It clears the tactic input if
		 * the row to delete is the only row in the table or it removes the row
		 * if there are multiple rows in the table.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		handleDeleteTactic: function (oEvent) {
			var aTactics = this.dataModel.getData().Tactics;
			if (aTactics.length === 1) {
				var oStartDate = this.dataModel.getProperty("/StartOfOffer");
				var oEndDate = this.dataModel.getProperty("/EndOfOffer");
				var oTime = this.timeModel.getData();
				aTactics[0] = {
					"Id": null,
					"StartOfTactic": oStartDate,
					"EndOfTactic": oEndDate,
					"StartTimeOfTactic": oTime.StartTime,
					"EndTimeOfTactic": oTime.EndTime,
					"EndTimeOfTacticValue": this.timeLabelValueFormatter(oTime.EndTime),
					"StartTimeOfTacticValue": this.timeLabelValueFormatter(oTime.StartTime)
				};
			} else {
				var sPath = oEvent.getParameter("listItem").getBindingContext().getPath();
				var aTemp = sPath.split("/");
				var iRowIndex = aTemp[aTemp.length - 1];
				aTactics.splice(iRowIndex, 1);
			}
			this.dataModel.updateBindings();
			this.validateTactics();
		},

		/**
		 * Fired when changing the value from the tactic type input.
		 * If the entered value is a valid tactic id or tactic name, it automatically selects that tactic type.
		 * At the end it fires up the validation for the tactics.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onTacticTypeChange: function (oEvent) {
			var sValue = oEvent.getSource().getValue();
			var sPath = oEvent.getSource().getParent().getBindingContext().getPath();

			this.dataModel.setProperty(sPath + "/Id", null);

			if (!sValue) {
				this.validateTactics();
				return;
			}

			var selectTactic = function (oTactic) {
				var oRowData = this.dataModel.getProperty(sPath);
				jQuery.extend(oRowData, oTactic);
				this.dataModel.setProperty(sPath, oRowData);
			}.bind(this);

			var oTacticById = null,
				oTacticByName = null;
			var aTactics = this.contentModel.getData().TacticTypes;
			for (var i = 0; i < aTactics.length; i++) {
				var oTactic = aTactics[i];
				if (oTactic.Id === sValue.toUpperCase()) {
					oTacticById = oTactic;
					break;
				}
				if (oTactic.Name === sValue) {
					oTacticByName = oTactic;
				}
			}

			if (oTacticById) {
				selectTactic(oTacticById);
			} else if (oTacticByName) {
				selectTactic(oTacticByName);
			}

			this.validateTactics();
		},

		/**
		 * Triggered when changing tactic date or time.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onTacticTimeChange: function (oEvent) {
			var setDate = function (sProperty, oTime, startOrEnd) {
				var oDate = this.dataModel.getProperty(sProperty);
				var oDateResult;
				if (!oDate) {
					if (startOrEnd === "start") {
						oDate = this.dataModel.getProperty("/StartOfOffer");
					} else if (startOrEnd === "end") {
						oDate = this.dataModel.getProperty("/EndOfOffer");
					}
					oDateResult = this.getDate(oDate, oTime);
				} else {
					oDateResult = this.getDate(oDate, oTime);
				}
				this.dataModel.setProperty(sProperty, oDateResult);
			}.bind(this);

			var sRowPath = oEvent.getSource().getParent().getBindingContextPath();
			var oStartTime = this.dataModel.getProperty(sRowPath + "/StartTimeOfTactic");
			var oEndTime = this.dataModel.getProperty(sRowPath + "/EndTimeOfTactic");

			setDate(sRowPath + "/StartOfTactic", oStartTime, "start");
			setDate(sRowPath + "/EndOfTactic", oEndTime, "end");

			var startDate = this.dataModel.getProperty(sRowPath + "/StartOfTactic");
			var endDate = this.dataModel.getProperty(sRowPath + "/EndOfTactic");

			this.dataModel.setProperty(sRowPath + "/StartOfTactic", new Date(NaN));
			this.dataModel.setProperty(sRowPath + "/StartOfTactic", startDate);
			this.dataModel.setProperty(sRowPath + "/EndOfTactic", new Date(NaN));
			this.dataModel.setProperty(sRowPath + "/EndOfTactic", endDate);

			this.validateTactics();
		},

		buildTacticsErrors: function (i18nBundle, oModel) {

			function isValidTacticType(item) {
				return item.Id;
			}

			function datesEqual(d1, d2) {
				var d1Props = {
					day: d1.getDate(),
					month: d1.getMonth(),
					year: d1.getFullYear()
				};

				var d2Props = {
					day: d2.getDate(),
					month: d2.getMonth(),
					year: d2.getFullYear()
				};

				return jQuery.sap.equal(d1Props, d2Props);
			}

			function datesLessThen(d1, d2) {
				return d1.getTime() < d2.getTime();
			}

			function getTarget(index, path) {
				return "/Tactics/" + index + path;
			}

			function isDuplicate(tactic, modelData) {
				return modelData.Tactics.some(function (item) {
					return !!item.Id && tactic !== item && item.Id === tactic.Id;
				});
			}

			function getErrors(tactic, i) {
				var errors = [];

				function error(message, description, target) {
					errors.push({
						message: i18nBundle.getText(message),
						description: i18nBundle.getText(description, i + 1),
						type: "Error",
						target: getTarget(i, target),
						processor: oModel
					});
				}

				function time(date) {
					var t = new Date(0);
					t.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
					return t;
				}

				if (!isValidTacticType(tactic, oModel.getData())) {
					error("CreateOffer.General.Tactics.Errors.InvalidTacticType", "CreateOffer.General.Tactics.Errors.InvalidTacticTypeRow", "/Name");
				}

				var tacticStart = (tactic.StartOfTactic);
				var tacticEnd = (tactic.EndOfTactic);
				var tacticTimeStart = time(tactic.StartTimeOfTactic);
				var tacticTimeEnd = time(tactic.EndTimeOfTactic);
				var offerStart = (oModel.getData().StartOfOffer);
				var offerEnd = (oModel.getData().EndOfOffer);
				var offerTimeStart = time(oModel.getData().StartOfOffer);
				var offerTimeEnd = time(oModel.getData().EndOfOffer);

				if (datesEqual(tacticStart, offerStart)) {

					if (datesLessThen(tacticTimeStart, offerTimeStart)) {
						error("CreateOffer.General.Tactics.Errors.TimeFrom", "CreateOffer.General.Tactics.Errors.StartTimeLowerThanStartOfOffer",
							"/StartTimeOfTactic");
					}
					if (datesEqual(offerStart, offerEnd)) {
						if (datesLessThen(offerTimeEnd, tacticTimeStart)) {
							error("CreateOffer.General.Tactics.Errors.TimeFrom", "CreateOffer.General.Tactics.Errors.StartTimeBiggerThanEndOfOffer",
								"/StartTimeOfTactic");
						}
					}

				} else { //dates are different, need to highlight date picker if error

					if (datesLessThen(tacticStart, offerStart)) {
						error("CreateOffer.General.Tactics.Errors.DateFrom", "CreateOffer.General.Tactics.Errors.StartDateLowerThanStartDateOfOffer",
							"/StartOfTactic");
					}

					if (datesLessThen(offerEnd, tacticStart)) {
						error("CreateOffer.General.Tactics.Errors.DateFrom", "CreateOffer.General.Tactics.Errors.StartDateBiggerThanEndDateOfOffer",
							"/StartOfTactic");
					}
				}

				if (datesEqual(tacticEnd, offerEnd)) {

					if (datesLessThen(offerTimeEnd, tacticTimeEnd)) {
						error("CreateOffer.General.Tactics.Errors.TimeTo", "CreateOffer.General.Tactics.Errors.EndTimeBiggerThanEndOfOffer",
							"/EndTimeOfTactic");
					}
					if (datesEqual(offerStart, offerEnd)) {
						if (datesLessThen(tacticTimeEnd, offerTimeStart)) {
							error("CreateOffer.General.Tactics.Errors.TimeTo", "CreateOffer.General.Tactics.Errors.EndTimeLowerThanStartOfOffer",
								"/EndTimeOfTactic");
						}
					}

				} else {

					if (datesLessThen(tacticEnd, offerStart)) {
						error("CreateOffer.General.Tactics.Errors.DateTo", "CreateOffer.General.Tactics.Errors.EndDateLowerThanStartDateOfOffer",
							"/EndOfTactic");
					}

					if (datesLessThen(offerEnd, tacticEnd)) {
						error("CreateOffer.General.Tactics.Errors.DateTo", "CreateOffer.General.Tactics.Errors.EndDateBiggerThanEndDateOfOffer",
							"/EndOfTactic");
					}
				}

				if (!datesEqual(tacticStart, tacticEnd)) {

					if (datesLessThen(tacticEnd, tacticStart)) {
						error("CreateOffer.General.Tactics.Errors.CDateFrom", "CreateOffer.General.Tactics.Errors.StartDateBiggerThanEndDate",
							"/StartOfTactic");
						error("CreateOffer.General.Tactics.Errors.CDateTo", "CreateOffer.General.Tactics.Errors.EndDateLowerThanStartDate",
							"/EndOfTactic");
					}
				}

				if (datesEqual(tacticStart, tacticEnd)) {

					if (datesLessThen(tacticTimeEnd, tacticTimeStart)) {
						error("CreateOffer.General.Tactics.Errors.CTimeFrom", "CreateOffer.General.Tactics.Errors.StartTimeBiggerThanEndTime",
							"/StartTimeOfTactic");
						error("CreateOffer.General.Tactics.Errors.CTimeTo", "CreateOffer.General.Tactics.Errors.EndTimeLowerThanStartTime",
							"/EndTimeOfTactic");
					}
				}

				if (isDuplicate(tactic, oModel.getData())) {
					error("CreateOffer.General.Tactics.Errors.DuplicatedTacticTypes", "", "/Name");
				}

				return errors;
			}

			var aTactics = oModel.getData().Tactics;
			return aTactics.reduce(function (result, tactic, i) {
				return result.concat(getErrors(tactic, i));
			}, []);
		},

		validateTactics: function () {
			var i18nBundle = this.i18nModel.getResourceBundle();
			var aMessages = this.buildTacticsErrors(i18nBundle, this.dataModel);
			Utils.removeMessagesByPath("/Tactics");
			Utils.setErrorMessages(this.oMessageManager, aMessages, this.dataModel);
			return aMessages.length;
		},

		validateTable: function (aItems, oValidations) {
			for (var i = 0; i < aItems.length; i++) {
				if (oValidations.skipRowFn(aItems[i])) {
					continue;
				}
				for (var j = 0; j < oValidations.iterationValidations.length; j++) {
					oValidations.iterationValidations[j](aItems[i], i);
				}
			}
			oValidations.validations.forEach(function (fn) {
				fn(aItems);
			});
		},

		validateManageOfferSet: function (value) {
			var duplicateName = function (value) {
				var aOfferSets = this.offerSetModel.getData().OfferSets;
				for (var i = 0, iLen = aOfferSets.length; i < iLen; i++) {
					if (aOfferSets[i].Text === value) {
						return true;
					}
				}
				return false;
			}.bind(this);

			var error = {
				text: this.i18nModel.getResourceBundle().getText("ErrorMessage.General.OfferSetEmptyName"),
				state: "Error",
				error: true
			};
			if (!value.length) {
				return error;
			} else if (duplicateName(value)) {
				error.text = this.i18nModel.getResourceBundle().getText("ErrorMessage.General.OfferSetAlreadyExists");
				return error;
			} else {
				return {
					text: "",
					state: "None",
					error: false
				};
			}
		},

		onManageOfferPress: function () {
			var that = this;
			Models.getOfferSet().then(function (returnData) {
				var data = returnData.data || [];
				that.offerSetModel.setData({
					"OfferSets": data,
					"Count": data.length,
					"iLastModified": null
				});
				that.manageOfferSetsDialog.setModel(that.offerSetModel, "OfferSet");
				that.manageOfferSetsDialog.open();
			});
		},

		onSaveOfferSets: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var data = {
				"remove": [],
				"update": [],
				"add": []
			};

			var bStatusChanged = false;
			var currentOfferSet = {
				Id: this.dataModel.getProperty("/OfferSetId"),
				Text: this.dataModel.getProperty("/OfferSetName")
			};

			for (var i = 0, iLen = aOfferSets.length; i < iLen; i++) {
				if (aOfferSets[i].status) {
					var item = {
						Id: aOfferSets[i].Id,
						Text: aOfferSets[i].Text
					};
					if (currentOfferSet.Id && item.Id === currentOfferSet.Id) {
						currentOfferSet.Text = item.Text;
					}
					if (item.Id === currentOfferSet.Id && aOfferSets[i].status === "remove") {
						currentOfferSet.Text = null;
						currentOfferSet.Id = null;
					}

					data[aOfferSets[i].status].push(item);
					bStatusChanged = true;
				}
			}
			this.manageOfferSetsDialog.close();
			if (!bStatusChanged) {
				return;
			}

			Utils.getErrorHandler().showBusy();
			var that = this;
			Models.manageOfferSet(data).then(function (data) {
				var results = Utils.get(data, ["returnedData", "__batchResponses"]) || [];

				//keep only 'add' calls and filter out everything else
				var changes = results.map(function (result) {
					return result.__changeResponses || [];
				}).reduce(function (a, b) {
					return a.concat(b);
				}, []).filter(function (change) {
					return !!change.data;
				}).map(function (change) {
					return change.data;
				});

				var firstOffer = changes[0] || currentOfferSet;

				that.dataModel.setProperty("/OfferSetName", firstOffer.Text);
				that.dataModel.setProperty("/OfferSetId", firstOffer.Id);
				that.contentModel.setProperty("/OfferSetValue", firstOffer.Text);

				Utils.getErrorHandler().hideBusy();
			}, function () {
				Utils.getErrorHandler().hideBusy();
			});

		},

		onOfferSetsSearch: function (oEvent) {
			var aFilters = [];
			var sQuery = oEvent.getSource().getValue();
			if (sQuery && sQuery.length > 0) {
				var filter = new Filter("Text", sap.ui.model.FilterOperator.Contains, sQuery);
				aFilters.push(filter);
			}
			var list = sap.ui.getCore().byId("OfferSetManageListId");
			var binding = list.getBinding("items");
			binding.filter(aFilters, "Application");
			this.offerSetModel.setProperty("/Count", binding.getLength());
			this.offerSetModel.refresh(true);
		},

		onCancelOfferSets: function (oEvent) {
			this.manageOfferSetsDialog.close();
		},

		validateOfferSetText: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var sPath = oEvent.getSource().getBindingContext("OfferSet").getPath();
			var selectedIndex = sPath.split("/")[2];

			var valid = this.validateManageOfferSet(oEvent.getSource().getValue().trim());
			aOfferSets[selectedIndex].ValueState = valid.error;
			aOfferSets[selectedIndex].ValueStateText = valid.text;
		},

		handleEditOfferSetPress: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var sPath = oEvent.getSource().getBindingContext("OfferSet").getPath();
			var selectedIndex = sPath.split("/")[2];
			if (this.offerSetModel.getData().iLastModified !== null) {
				aOfferSets[this.offerSetModel.getData().iLastModified].isEditValue = false;
				aOfferSets[this.offerSetModel.getData().iLastModified].ValueState = false;
			}
			this.offerSetModel.getData().iLastModified = selectedIndex;
			aOfferSets[selectedIndex].isEditValue = !aOfferSets[selectedIndex].isEditValue;
			aOfferSets[selectedIndex].TextInput = aOfferSets[selectedIndex].Text;
			this.offerSetModel.updateBindings(true);
		},

		handleDeleteOfferSetPress: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var sPath = oEvent.getSource().getBindingContext("OfferSet").getPath();
			var selectedIndex = sPath.split("/")[2];

			var sMsg = this.i18nModel.getResourceBundle().getText("CreateOffer.General.ManageOfferSets.DeleteText", aOfferSets[selectedIndex].Text);
			var dialogProperties = {
				"massageSingle": sMsg,
				"title": "CreateOffer.General.ManageOfferSets.Delete"
			};
			Utils.openDeleteConfirmDiaog(true, dialogProperties).then(function () {
				this.offerSetModel.getData().Count--;
				aOfferSets[selectedIndex].status = "remove";
				aOfferSets[selectedIndex].isDeleted = true;
				this.offerSetModel.updateBindings(true);
			}.bind(this));
		},

		handleOkOfferSetPress: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var sPath = oEvent.getSource().getBindingContext("OfferSet").getPath();
			var selectedIndex = sPath.split("/")[2];
			if (aOfferSets[selectedIndex].ValueState) {
				return;
			}
			aOfferSets[selectedIndex].isEditValue = !aOfferSets[selectedIndex].isEditValue;
			if (aOfferSets[selectedIndex].Text !== aOfferSets[selectedIndex].TextInput) {
				aOfferSets[selectedIndex].status = "update";
			}
			aOfferSets[selectedIndex].Text = aOfferSets[selectedIndex].TextInput;
			this.offerSetModel.updateBindings(true);
		},

		handleCancelOfferSetPress: function (oEvent) {
			var aOfferSets = this.offerSetModel.getData().OfferSets;
			var sPath = oEvent.getSource().getBindingContext("OfferSet").getPath();
			var selectedIndex = sPath.split("/")[2];
			aOfferSets[selectedIndex].isEditValue = !aOfferSets[selectedIndex].isEditValue;
			aOfferSets[selectedIndex].ValueState = false;
			this.offerSetModel.updateBindings(true);
		},

		handleAddOfferSetPress: function (oEvent) {
			var that = this;
			var dialog = sap.ui.xmlfragment(
				"retail.pmr.promotionaloffers.plugins.general.NewOfferSetDialog", {
					validateNewOfferSetText: function (oEvent) {
						var valid = that.validateManageOfferSet(oEvent.getSource().getValue());
						var input = oEvent.getSource();
						input.setValueStateText(valid.text);
						input.setValueState(valid.state);
					},

					onOkPress: function () {
						var input = sap.ui.getCore().byId("newOfferSet");
						var sText = input.getValue().trim();
						var valid = that.validateManageOfferSet(sText);
						input.setValueStateText(valid.text);
						input.setValueState(valid.state);
						if (valid.error) {
							return;
						}
						that.offerSetModel.getData().OfferSets.push({
							Id: "",
							Text: sText,
							status: "add"
						});
						that.offerSetModel.getData().Count++;
						that.offerSetModel.updateBindings(true);
						dialog.close();
					},

					onCancelPress: function () {
						dialog.close();
					},

					onAfterClose: function () {
						dialog.destroy();
					}
				}
			);

			dialog.setModel(this.i18nModel, "i18n");
			dialog.open();
		},

		offerSetDeleteButtonFormatter: function (offers) {
			return !offers;
		},

		offerSetChangedFormatter: function (changedByName, changedOn) {
			if (!changedByName && !changedOn) {
				return "";
			}
			var formatter = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "MMM dd HH:mm a"
			});
			return changedByName + " - " + formatter.format(changedOn);
		},
		/**
		 * Gets the index from a given path.
		 *
		 * @param {string} sPath The path.
		 * @returns {string} The index
		 */
		getIndexFromPath: function (sPath) {
			var aTemp = sPath.split("/");
			return aTemp[aTemp.length - 1];
		},

		liveSearchLocation: Utils.liveChangeFilterHandler(["ExtNodeId", "HierarchyDescription"], "LocationTreeTable"),

		timeLabelVisibilityFormatter: function (editable) {
			return !editable;
		},
		timeLabelValueFormatter: function (time) {
			return this.dateHandler.getFormatTimePiker(time);
		},

		togglePackageOffer: function (e) {
			var that = this;

			var shouldPromptUser = function shouldPromptUser() {
				return (that.getOwnerComponent().getState().getSavePayload().Terms.length > 0) ||
					(that.getOwnerComponent().getState().getSavePayload().Incentives.length > 0);
			};

			if (shouldPromptUser()) {
				promptUserForPackageOfferChange(e.getParameter("selected"), that.getView().getModel("i18n"))
					.then(function (newValue) {
						that.eventBus.publish("retail.pmr.promotionaloffers", "resetTermsTab");
					}, function (reset) {
						that.dataModel.setProperty("/PackageOffer", reset);
					});
			} else {
				that.eventBus.publish("retail.pmr.promotionaloffers", "resetTermsTab");
			}
		},
		resetFilters: function () {
			this.dataModel.setProperty("/ExcludedNodes", []);
			this.dataModel.setProperty("/LocationFilters", []);
			var stores = this.contentModel.getProperty("/TotalStores");
			this.updateLocationLabel(stores, stores);
		},
		advancedLocationSettings: function () {
			var router = sap.ui.core.UIComponent.getRouterFor(this);
			var state = this.getOwnerComponent().getState();
			var offer = state.processor.createSavePayloadWithFinancials();
			var hierarchyChanged = this.contentModel.getProperty("/Hierarchy");

			// fix the bug with navigating to location groups create
			if (hierarchyChanged) {
				offer.LocationHierarchy = Utils.buildLocationHierarchyFromVH(hierarchyChanged);
			}

			var offerId = offer.OfferId;
			var locationId = offer.LocationNodeId;

			state.setTransientSnapshot(offer);
			state.store(offer, {});

			if (!offerId) {
				router.navTo("locationGroupsCreate", {
					locationId: Utils.base64ToHex(locationId)
				});
			} else {
				router.navTo("locationGroups", {
					path: Utils.base64ToHex(offerId),
					locationId: Utils.base64ToHex(locationId)
				});
			}
		},

		isPackageOffer: function () {
			return this.dataModel.getProperty("/PackageOffer") || false;
		},
		notNull: function (x) {
			return !!x;
		},

		isCouponOfferSelect: function () {
			var bCouponOffer = this.dataModel.getProperty("/IsCouponOffer") || false;
			if (bCouponOffer) {
				//update total audience
				var nTotalAudience = this.getTotalAudience(this.dataModel.getProperty("/TargetGroups"));
				this.contentModel.setProperty("/TotalAudience", nTotalAudience);
			}
		},

		resetCouponData: function () {
			if (this.dataModel.getProperty("/IsCouponOffer") === false) {
				this.dataModel.setProperty("/EnforceEligibility", false);
				this.dataModel.setProperty("/UniqueIdRequired", false);
				this.dataModel.setProperty("/WebCode", "");
				this.dataModel.setProperty("/MaxRedemp", 0);
				this.dataModel.setProperty("/PersonalMaxRedemp", 0);
				this.dataModel.setProperty("/UniqueIdLimit", 0);
				this.contentModel.setProperty("/TotalAudience", 0);
			}
			
			//clear up error messages and reset to default values
			var fields = ["EligibilityDays",
				"EligibilityOffset",
				"MaxRedemp",
				"PersonalMaxRedemp",
				"UniqueIdLimit"
			];
			var that = this;
			fields.forEach(function (field) {
				var sFieldState = that.getView().byId(field).getValueState();
				if (sFieldState === "Error") {
					that.getView().byId(field).setValueState("None");
					that.getView().byId(field).setValue(0);
				}
			});

		}

	});
});