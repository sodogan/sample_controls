/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/utils/OfferOperations",
	"retail/pmr/promotionaloffers/plugins/versions/VersionsSelector",
	"retail/pmr/promotionaloffers/utils/Models",
	"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer",
	"retail/pmr/promotionaloffers/plugins/versions/VersionsHelper",
	"retail/pmr/promotionaloffers/view/CommunicationServices",
	"sap/ui/core/routing/History",
	"retail/pmr/promotionaloffers/utils/ForecastDialog"
], function (Controller, JSONModel, Utils, OfferOperations,
	VersionsSelector, Models, ValueHelpDialogTokenizer, VersionsHelper, CommunicationServices,
	History, ForecastDialog) {
	"use strict";


	function createLocalNodes(parent, items) {
		var children = [];
		var toReturn = null;
		if (items.length >= 2) {
			for (var i = 0, iLen = items.length; i < iLen; i++) {
				children.push(Utils.getNodeType(items[i], "NodeId", "NodeType"));
			}

			var parentID = parent.NodeId || parent.LocationId;
			var description;
			for (var k = 0; k < items.length; k++) {
				if (k == 0){
					description = items[0].Name.concat(" (", items[0].ExtLocationId, ")");
				}
				else{
					if (description.length > 40) {
					description = description.substring(0, 37) + "...";
					break;
					}
					description = (description).concat(";", items[k].Name, " (", items[k].ExtLocationId, ")");
				}
			}
			if (description.length > 40){
				description = description.substring(0, 37) + "...";
			}
			toReturn = {
				"ParentId": parentID,
				"Description": description,
				"Children": children,
				"HierarchyId": parent.HierarchyId
			};
		} else {
			var locationNodeId = items[0].NodeId || items[0].LocationId;
			toReturn = {
				"LocationNodeId": locationNodeId,
				"HierarchyId": parent.HierarchyId
			};
		}

		return toReturn;
	}

	var MAX_WIDTH = 10000;
	var MIN_WIDTH = 0;

	var oMessagePopover = Utils.getErrorHandler().createMessagePopover();

	function shouldExitDirectly(hasVersionChanges, isDisplay) {
		if (hasVersionChanges && !isDisplay) {
			return false;
		}
		return true;
	}

	function hasChanges(controller) {
		controller.isForSave = true;
		controller.removeFinancial = true;
		var hasVersionChanges = controller.state.hasChanges();
		return hasVersionChanges;
	}

	function createCancelDialog(options) {
		if (shouldExitDirectly(hasChanges(options.controller), options.controller.isDisplayMode)) {
			return Promise.resolve();
		}

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

	function OfferDataProvider(mainController) {
		this.getOfferData = function () {
			if (!mainController) {
				return {};
			}
			return mainController.preparePayloadForSave(true, true);
		};
		this.getOfferWithFinancials = function () {
			if (!mainController) {
				return {};
			}
			return mainController.preparePayloadForSave(true, true);
		};
	}

	function getVersionIndex(versions, versionObject) {
		if (versions) {
			for (var i = 0; i < versions.length; i++) {
				var versionLocation = null;
				if (versions[i]) {
					versionLocation = versions[i].LocationNodeId || versions[i].LocationId || versions[i].ExtLocationNodeId;
				}
				var versionObjectLocation = versionObject.LocationNodeId || versionObject.LocationId || versionObject.ExtLocationNodeId ||
					versionObject.NodeId;
				if (versionLocation === versionObjectLocation) {
					return i;
				}
			}
		}
		return -1;
	}

	function isEmpty(obj) {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				return false;
			}
		}

		return true;
	}

	function getParentByPath(treeTable, path, isParent) {
		var parentPath = path;
		if (!isParent) {
			parentPath = path.substring(0, path.lastIndexOf("/"));
		}
		var parent = null;
		var index = 0;
		do {
			var context = treeTable.getContextByIndex(index);
			if (context && context.sPath === parentPath) {
				parent = createLocationSelected(context);
				break;
			}
			index++;
		} while (context);
		return parent;
	}

	function getVersionSelected(versions, locationSelected, controller) {
		var currentVersion = {};
		var isShowingParent = false;
		var getVersionInLocation = function (versions, locationSelected) {
			if (versions && locationSelected) {
				for (var i = 0; i < versions.length; i++) {
					var versionLocation = versions[i].LocationNodeId || versions[i].LocationId || versions[i].ExtLocationNodeId;
					var locationSelectedId = locationSelected.LocationNodeId || locationSelected.NodeId || locationSelected.ExtLocationId;
					if (versionLocation === locationSelectedId) {
						currentVersion = versions[i];
						currentVersion.Readonly = controller.isDisplayMode;
						if (controller.locationSelected.LocationNodeId !== versionLocation && controller.locationSelected.ExtLocationId !==
							versionLocation && !controller.locationSelected.isTopLevel) {
							currentVersion.Readonly = true;
							isShowingParent = true;
						}
						break;
					}
				}
			}
			if (currentVersion && !isEmpty(currentVersion)) {
				currentVersion.isShowingParent = isShowingParent;
				return currentVersion;
			}
			currentVersion = null;
			var parent = getParentByPath(controller.getSideBarTable(), locationSelected.path);
			if (parent && !parent.isTopLevel) {
				getVersionInLocation(versions, parent);
			}
		};
		getVersionInLocation(versions, locationSelected);

		return currentVersion;
	}

	function getVersionAsChild(versions, locationSelected, controller) {
		var versionAsChild = null;
		if (versions && locationSelected) {
			for (var i = 0; i < versions.length; i++) {
				var versionLocation = versions[i].LocationNodeId || versions[i].LocationId || versions[i].ExtLocationNodeId;
				var locationSelectedId = locationSelected.LocationNodeId || locationSelected.NodeId || locationSelected.ExtLocationId;
				if (versionLocation === locationSelectedId) {
					versionAsChild = versions[i];
					break;
				}
			}
		}
		return versionAsChild;
	}

	function controllerById(view, id) {
		return view.byId(id).getController();
	}

	function getLocationNodeName(treeTable, locationNodeId) {
		var locationNodeName = "";
		var index = 0;
		do {
			var context = treeTable.getContextByIndex(index);
			if (!context) {
				continue;
			}
			var object = context.getObject();
			var locationId = object.LocationId || object.NodeId;
			if (locationId === locationNodeId) {
				locationNodeName = object.ExtLocationId || object.ExtNodeId;
				break;
			}
			index++;
		} while (context);
		return locationNodeName;
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

	function createLocationSelected(context, object) {

		var locationSelected = {};
		if (context) {
			var object = context.getObject();
			locationSelected.path = context.getPath();
			locationSelected.LocationNodeId = object.NodeId || object.LocationId;
			locationSelected.NodeId = object ? object.NodeId : "";
			locationSelected.Name = object ? object.Name : "";
			locationSelected.HierarchyId = object.HierarchyId;
			locationSelected.ParentId = object.ParentId;
			locationSelected.ExtLocationId = object.ExtLocationId || object.ExtNodeId;
			locationSelected.objectLocationTree = context.getModel().getData()[0];
			locationSelected.isTopLevel = object.ParentId === locationSelected.objectLocationTree.ParentId ? true : false;
			locationSelected.hasVersion = object.hasVersion;
			locationSelected.isExcluded = object.excluded;
			locationSelected.isClosed = object.isClosed;
		} else if (object) {
			locationSelected.LocationNodeId = object.NodeId || object.LocationId;
			locationSelected.NodeId = object ? object.NodeId : "";
			locationSelected.Name = object ? object.Name : "";
			locationSelected.HierarchyId = object.HierarchyId;
			locationSelected.ExtLocationId = object.ExtLocationId || object.ExtNodeId;
		}

		return locationSelected;
	}

	function refreshTreeTable(treeTable) {
		treeTable.refreshRows(true);
		treeTable.getModel().refresh(true);
	}

	function getIndexByPath(treeTable, path) {
		var result = -1;
		var index = 0;
		do {
			var context = treeTable.getContextByIndex(index);
			if (context && context.sPath === path) {
				result = index;
				break;
			}
			index++;
		} while (context);
		if (!context && result === -1) {
			throw new Error("Context undefined");
		}
		return result;
	}

	function getPathByLocationId(treeTable, locationNodeId) {
		var path = "";
		var index = 0;
		do {
			var context = treeTable.getContextByIndex(index);
			if (!context) {
				continue;
			}
			var object = context.getObject();
			var locationId = object.LocationId || object.NodeId || object.ExtNodeId;
			if (locationId === locationNodeId) {
				path = context.getPath();
				break;
			}
			if (object.NodeId !== "" || (object.userCreatedNode && object.ExtNodeId !== "")) {
				treeTable.expand(index);
				refreshTreeTable(treeTable);
			}
			index++;
		} while (context);
		return path;
	}

	function expandTreeTableByPath(treeTable, path, expandAllPath) {
		var pathArray = [];
		pathArray = path.split("/");
		pathArray.shift();
		if (pathArray.length > 1 && !expandAllPath) {
			pathArray.pop();
		}
		var newPath = "";
		for (var i = 0; i < pathArray.length; i++) {
			newPath += "/" + pathArray[i];
			var index = getIndexByPath(treeTable, newPath);
			treeTable.expand(index);
			refreshTreeTable(treeTable);

		}
	}

	function getExpandedNodes(treeTable) {
		var expandedPaths = [];
		var expandedIndexes = [];
		var index = 0;
		do {
			var context = treeTable.getContextByIndex(index);
			if (treeTable.isExpanded(index)) {
				if (context) {
					expandedPaths.push(context.getPath());
					expandedIndexes.push(index);
				}
			}
			index++;
		} while (context);
		return {
			paths: expandedPaths,
			indexes: expandedIndexes
		};
	}

	function checkForError(sMsg) {
		var oErrorHandler = Utils.getErrorHandler();
		if (oErrorHandler.numOfErrors() > 0) {
			oErrorHandler.showError(sMsg);
		}
	}

	function resetNewVersion(oVersion) {
		//Reset user projection on each term and term product
		var oRVersion = oVersion;

		//Reset header financials
		oVersion.Margin = "0";
		oVersion.Sales = "0";
		oVersion.Profit = "0";
		oVersion.UnitProjection = "0";
		oVersion.UnitForecast = "0";
		oVersion.VendorFundImpact = "0";

		if (jQuery.isArray(oRVersion.Terms)) {
			oRVersion.Terms = oRVersion.Terms.map(function (oTerm) {
				if (jQuery.isArray(oTerm.TermProducts)) {
					var oRTerm = oTerm;
					oRTerm.TermProducts = oRTerm.TermProducts.map(function (oTermProduct) {
						oTermProduct.UserProjection = null;
						oTermProduct.LockUserProjection = false;
						return oTermProduct;
					});

					oRTerm.UserProjection = null;
					oRTerm.LockUserProjection = false;

					return oRTerm;
				} else {
					return oTerm;
				}
			});
		}

		return oRVersion;
	}

	return Controller.extend("retail.pmr.promotionaloffers.view.VersionTabs", {
		constructor: function () {
			this.dataModel = new JSONModel();
			this.contentModel = new JSONModel();
			this.featureModels = new JSONModel();
			this.quickViewModel = new JSONModel();
			this.uiSettings = new JSONModel();
		},

		startLoading: function (state, versionId) {
			state.load(function () {
				return Models.getMetadataAnalyzer().then(function () {
					var offer = state.getOfferData();
					var versions = offer.Versions;
					var selectedVersion = null;
					for (var i = 0, iLen = versions.length; i < iLen; i++) {
						if (Utils.base64ToHex(versions[i].OfferId) === versionId) {
							selectedVersion = versions[i];
							var versionReadOnlyState = this.pathName === "versionDisplay" ? true : false;
							selectedVersion.Readonly = versionReadOnlyState;
							break;
						}
					}
					this.setVersionData(offer, state.getStaticData(), null, selectedVersion, true);
					this.toggleCollisionBtn();
				}.bind(this));
			}.bind(this), function (error) {
				jQuery.sap.log.error(error.stack);
			});
		},

		onInit: function () {
			this.snapshot = {};
			this.getView().setModel(this.dataModel);
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.featureModels, "featuresAvailable");
			this.getView().setModel(this.uiSettings, "uiSettings");
			this.generalController = controllerById(this, "generalVersionView");
			this.termsController = controllerById(this, "termsVersionView");
			this.termsController.setGeneralDataModel({
				getDataModel: function () {
					return this.generalController.dataModel;
				}.bind(this)
			});

			this.oMessageManager = Utils.getMessageManager();
			oMessagePopover.setModel(this.oMessageManager.getMessageModel());
			this.i18nBundle = Utils.getResourceModel();
			this.uiSettings.setProperty("/VersionForBackButton", sap.ui.version > "1.38.7" ? true : false);
			this.contentModel.setProperty("/ShowVesionList", true);
			this.contentModel.setProperty("/isPhone", sap.ui.Device.system.phone);
			this.contentModel.setProperty("/HideExcludedNodes", false);
			this.state = this.getOwnerComponent().getState();

			this.getRouter().attachRouteMatched(function (e) {
				var prevPathName = this.pathName;
				this.pathName = e.getParameter("name");
				this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.promptMSDChange, this);
				if (this.pathName === "versionCreate") {
					this.getEventBus().subscribe("retail.pmr.promotionaloffers", "onMasterDataSystemChange", this.promptMSDChange, this);
				}
				if (["versionCreate", "versionDisplay", "versionEdit"].indexOf(this.pathName) === -1) {
					return;
				}
				this.isDisplayMode = this.pathName === "versionDisplay" ? true : false;
				var history = History.getInstance();
				var lastHash = history.aHistory[history.aHistory.length - 1];
				if (lastHash.indexOf("productGroup") !== -1) {
					this.generalController.validateForm();
					this.termsController.validateForm();
					return;
				}
				if (history.getPreviousHash() && this.state.historyBack !== undefined) {
					return;
				}

				if (this.pathName !== "versionCreate" && !prevPathName) {
					this.startLoading(this.state, e.getParameter("arguments").id);
				}
			}.bind(this));

			//Set left pane width, it does not work via XML definition
			var treePane = this.getView().byId("treePane");
			var layoutData = new sap.ui.layout.SplitterLayoutData({
				size: "30%"
			});
			treePane.setLayoutData(layoutData);

			this.aFinHeaderFields = ["marginField", "unitField", "salesField", "profitField", "fundField", "forecastField"].map(function (x) {
				return this.getView().byId(x);
			}, this);

			this.aForecastHeaderFields = ["forecastField"].map(function (x) {
				return this.getView().byId(x);
			}, this);

			this.offerOperations = new OfferOperations(this.state);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "toggleCollisionBtn", this.toggleCollisionBtn, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "onVersionLocationChange", this.updateLocationFromPicker, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "validateVersions", this.validateVersionsListener, this);

		},

		onExit: function () {
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "toggleCollisionBtn", this.toggleCollisionBtn, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "onVersionLocationChange", this.updateLocationFromPicker, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "validateVersions", this.validateVersionsListener, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "changeLocationNameInSideTable", this.tableSoftRefresh, this);
		},

		resetLocationSelected: function () {
			this.locationSelected = null;
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

		showForecast: function (oEvent) {
			var sId = this.getView().getModel().getProperty("/OfferId") || this.getView().getModel().getProperty("/LeadingOffer");
			var oKey = {
				OfferId: sId
			};
			ForecastDialog.show(ForecastDialog.Level.Offer, oKey, Models.getServiceModel(), Utils.getResourceModel());
		},

		tableSoftRefresh: function (channel, event, context) {
			if (context.versionName) {
				this.dataModel.setProperty("/Name", context.versionName);
			}
			var currentHierarchy = this.selector.getCurrentHierarchy();
			this.saveShadowVersion();
			var expandedNodes = this.table ? getExpandedNodes(this.getSideBarTable()) : null;
			this.expandedPaths = expandedNodes && !this.isUserNodeCreated ? expandedNodes.paths : ["/0"];
			this.isAlreadySelected = true;
			this.isUserNodeCreated = false;
			this.selector.setTreeTableData(currentHierarchy, this.offerData.Versions);
			jQuery.sap.delayedCall(0, this, function () {
				this.expandedPaths.forEach(function (path) {
					if (path) {
						expandTreeTableByPath(this.getSideBarTable(), path, true);
					}
				}.bind(this));
				this.reselectVersion();
			});
		},

		getRouter: function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		onCancel: function () {
			this.openCancelDialog();
		},

		/**
		 * Creates and opens the confirm dialog when pressing cancel.
		 * 
		 * @returns {void}
		 */
		openCancelDialog: function () {
			var cancelDialogOptions = {
				controller: this,
				view: this.getView(),
				title: "{i18n>CreateOffer.OfferCancelDialogTitle}",
				message: "{i18n>CreateOffer.OfferCancelDialogDescription}",
				btnOk: "{i18n>CreateOffer.CreateOfferDialog.Accept}",
				btnCancel: "{i18n>CreateOffer.CreateOfferDialog.Reject}"
			};
			var that = this;
			createCancelDialog(cancelDialogOptions).then(function () {
				that.goBackToMainOffer(false);
				that.oMessageManager.removeAllMessages();
				that.cleanModel();
			}, Utils.identity);
		},

		onNavButtonPress: function () {
			this.goBackToMainOffer(true);

		},
		onToggleSideMenu: function () {
			if (this.contentModel.getProperty("/ToggleSplitPanePressed") === false) {
				this.contentModel.setProperty("/SplitParentWidth", MAX_WIDTH);
				this.contentModel.setProperty("/ToggleSplitPanePressed", true);
			} else {
				this.contentModel.setProperty("/SplitParentWidth", MIN_WIDTH);
				this.contentModel.setProperty("/ToggleSplitPanePressed", false);
			}
		},
		onShowExcluded: function () {
			this.reselectVersion(true);
		},

		alertNoLocationSelected: function () {
			var sMsg = this.i18nBundle.getResourceBundle().getText("Versions.NoSelectedLocationMessage");
			Utils.getErrorHandler().showError(sMsg);
		},

		onAddMultiple: function (oEvent) {
			var that = this;
			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.versions.VersionsTree", this);

			var selector = new VersionsSelector(table, this.hierarchy, this.i18nBundle, this.offerData.Versions, this.offerData.ExcludedNodes, []);

			table.attachToggleOpenState(function (e) {
				var params = {
					rowContext: e.getParameter("rowContext"),
					expanded: e.getParameter("expanded")
				};
				selector.asyncExpand(params);
			});

			var settingValueHelpDialog = {
				title: this.i18nBundle.getResourceBundle().getText("Versions.Location.ValueHelpDialog"),
				supportMultiselect: true,
				stretch: sap.ui.Device.system.phone,
				ok: function () {
					var selectedLocations = selector.getSelected();
					var parent = null;
					if (selectedLocations && selectedLocations.length > 0) {
						parent = selector.getParentItem(selectedLocations[0]);
						if (parent) {
							that.buildUserNode(parent, selectedLocations, true);
						} else {
							that.alertNoLocationSelected();
						}
						this.close();
						if (that._versionsDialog) {
							that._versionsDialog.destroy();
						}
					} else {
						that.alertNoLocationSelected();
					}
				},
				cancel: function () {
					this.close();
					that._versionsDialog.destroy();
					that.generalController.setLocationDataFromSnapshot();
				},
				selectionChange: function (e) {
					selector.selectionChanged(e);
				}
			};
			this._versionsDialog = new ValueHelpDialogTokenizer("versionsPickerID", settingValueHelpDialog);
			this._versionsDialog.addStyleClass("sapUiSizeCompact");
			this._versionsDialog.setTable(table);
			table.getModel().setSizeLimit(Utils.getSizeLimit());
			table.setVisibleRowCount(selector.data.length);
			selector.setVHDialog(this._versionsDialog, {
				StartOfOffer: this.offerData.StartOfOffer,
				EndOfOffer: this.offerData.EndOfOffer
			});
			selector.clearSelection();
			this._versionsDialog.open();
		},

		buildUserNode: function (parent, selectedLocations, addVersion) {
			this.onLoadingPage(true, true);
			var localNodes = [];
			this.saveShadowVersion();
			localNodes.push(createLocalNodes(parent, selectedLocations));
			var locationId = localNodes[0].LocationNodeId;
			if (!addVersion) {
				this.removeLocalNodes(this.locationSelected.ExtLocationId);
				locationId = this.locationSelected.LocationNodeId || this.locationSelected.ExtLocationId || localNodes[0].LocationNodeId;
			}
			var parentPath = getPathByLocationId(this.getSideBarTable(), addVersion ? localNodes[0].ParentId || localNodes[0].LocationNodeId :
				locationId);
			this.locationSelected = getParentByPath(this.getSideBarTable(), parentPath, true);
			this.addNewVersion = addVersion;
			var parentVersion = getVersionSelected(this.offerData.Versions, this.locationSelected, this);
			if (parentVersion) {
				parentVersion.StartOfOffer = new Date(parentVersion.StartOfOffer);
				parentVersion.EndOfOffer = new Date(parentVersion.EndOfOffer);
			}
			var currentVersion = this.getVersionData(parentVersion, localNodes);
			if (addVersion) {
				if (selectedLocations && selectedLocations.length > 1) {
					currentVersion.Name = "";
				}
				this.offerData.Versions.push(resetNewVersion(currentVersion));
				this.addNewVersion = false;
			} else {
				var index = getVersionIndex(this.offerData.Versions, this.originalSelectedVersion);
				if (index !== -1) {
					currentVersion.Readonly = false;
					this.offerData.Versions[index] = currentVersion;
				}
			}
			this.locationSelected = null;
			this.isNewVersion = true;
			this.isUserNodeCreated = true;
			this.setVersionData(this.offerData, this.staticData, null, currentVersion, true);
		},

		updateLocationFromPicker: function (channel, event, context) {
			if (context && context.parent) {
				this.buildUserNode(context.parent, context.selectedLocations, false);
			}
		},

		onAddSingle: function () {
			if ((this.originalSelectedVersion && !this.originalSelectedVersion.isShowingParent) || !this.locationSelected || this.locationSelected &&
				this.locationSelected.isTopLevel) {
				return;
			}
			this.onLoadingPage(true, true);
			this.addNewVersion = true;
			var parentVersion = getVersionSelected(this.offerData.Versions, this.locationSelected, this);
			var currentVersion = resetNewVersion(this.getVersionData(parentVersion));
			this.offerData.Versions.push(currentVersion);
			this.addNewVersion = false;
			this.isNewVersion = true;
			this.setVersionData(this.offerData, this.staticData, null, currentVersion, true);
		},

		getSideBarTable: function () {
			return sap.ui.getCore().byId("SideBarTreeTable");
		},

		toggleOpenState: function (oEvent) {
			this.isExpandRow = true;
		},

		onRowSelectionChange: function (oEvent) {
			if (this.isAlreadySelected) {
				this.isAlreadySelected = false;
				return;
			}

			var currentIndex = oEvent.getParameter("rowIndex");
			if (currentIndex === -1) {
				var selections = oEvent.getParameter("rowIndices");
				currentIndex = selections[selections.length - 1];
			}
			var currentSelectedPath = oEvent.getSource().getContextByIndex(currentIndex).getPath();

			if (currentSelectedPath === this.currentPath && !this.refreshTableOnExcludeSwitch) {
				return;
			}

			var myTable = this.getSideBarTable();
			var index = myTable.getSelectedIndex();

			if (index === -1 && this.currentPath) {
				var indexSelected = getIndexByPath(this.getSideBarTable(), this.currentPath ? this.currentPath : "/0");
				this.selectATreeRow(indexSelected);
				return;
			}
			this.saveShadowVersion();
			if (!this.verifyValidation()) {
				if (this.currentIndex !== index) {
					this.selectATreeRow(this.currentIndex);
				}
				return;
			}

			var context = myTable.getContextByIndex(index);
			if (context && this.currentPath === context.getPath() && !this.refreshTableOnExcludeSwitch) {
				this.selectATreeRow(this.currentIndex);
				return;
			}

			if (myTable.getSelectedIndices().length > 1) {
				var i = getIndexByPath(this.getSideBarTable(), this.currentPath ? this.currentPath : "/0");
				this.selectATreeRow(i);
				return;
			}

			this.locationSelected = createLocationSelected(context);
			if (context.getObject().OpeningDate) {
				this.locationSelected.isClosed = Utils.isClosed(context.getObject(), this.dataModel.getData().StartOfOffer, this.dataModel.getData()
					.EndOfOffer);
			}

			var currentVersion = getVersionSelected(this.offerData.Versions, this.locationSelected, this);

			this.currentIndex = index;
			this.currentPath = context.getPath();

			var parentId = this.offerData.OfferId;

			if (this.pathName !== "versionCreate") {
				this.getRouter().navTo(this.pathName, {
					path: Utils.base64ToHex(this.offerData.OfferId),
					id: currentVersion && currentVersion.OfferId ? Utils.base64ToHex(currentVersion.OfferId) : Utils.base64ToHex(parentId)
				}, true);
			}
			this.onLoadingPage(true, false);
			var refreshTable = this.refreshTableOnExcludeSwitch ? true : false;
			if (this.refreshTableOnExcludeSwitch) {
				this.refreshTableOnExcludeSwitch = false;
			}
			this.setVersionData(this.offerData, this.staticData, null, currentVersion, refreshTable);

		},

		createSideBarTable: function (hierarchyLocation, versions, excludeNodes) {

			function removeExcludedHierarchyNodes(hierarchy, excludedNodes) {
				for (var key in hierarchy) {
					if (hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)) {
						var currentSubNode = hierarchy[key];
						removeExcludedHierarchyNodes(currentSubNode, excludedNodes);
						for (var i = 0; i < excludedNodes.length; i++) {
							if ((currentSubNode.LocationId === excludedNodes[i].Id)) {
								delete hierarchy[key];
							}
						}
					}
				}
			}

			function markExcluded(hierarchy, excludedNodes) {
				for (var key in hierarchy) {
					if (hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)) {
						var currentSubNode = hierarchy[key];
						markExcluded(currentSubNode, excludedNodes);
						for (var i = 0; i < excludedNodes.length; i++) {
							if ((currentSubNode.LocationId === excludedNodes[i].Id)) {
								hierarchy[key].excluded = true;
							}
						}
					}
				}
			}

			function reIndexHierarchyNodes(hierarchy) {
				var result = {};
				var counter = 0;

				for (var key in hierarchy) {

					if (hierarchy.hasOwnProperty(key)) {
						if (jQuery.isNumeric(key)) {
							result[counter] = reIndexHierarchyNodes(hierarchy[key]);
							counter = counter + 1;
						} else {
							result[key] = hierarchy[key];
						}
					}
				}

				return result;
			}

			var calculateClosedStores = function (items) {
				if (Utils.isClosed(items, that.offerData.StartOfOffer, that.offerData.EndOfOffer)) {
					items.isClosed = true;
				}

				for (var i in items) {
					if (items.hasOwnProperty(i) && jQuery.isNumeric(i)) {
						if (Utils.isClosed(items[i], that.offerData.StartOfOffer, that.offerData.EndOfOffer)) {
							items[i].isClosed = true;
						}
						items[i].excluded = false;
						calculateClosedStores(items[i]);
					}
				}
			};

			var that = this;
			var hierarchy = [];

			if (hierarchyLocation && hierarchyLocation.hasOwnProperty("ParentId")) {
				hierarchy.push(hierarchyLocation);
			}
			calculateClosedStores(hierarchy);
			markExcluded(hierarchy, excludeNodes || []);

			var includedHierarchy = jQuery.extend(true, [], hierarchy);
			//removes the excluded nodes from hierarchy
			removeExcludedHierarchyNodes(includedHierarchy, excludeNodes);
			includedHierarchy = reIndexHierarchyNodes(includedHierarchy);

			this.contentModel.setProperty("/FullHierarchy", hierarchy);
			this.contentModel.setProperty("/IncludedHierarchy", includedHierarchy);

			if (this.contentModel.getProperty("/HideExcludedNodes")) {
				includedHierarchy = hierarchy;
			}
			if (!this.table) {
				this.table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.versions.LocationsTreeSideBar", this);
				this.selector = new VersionsSelector(this.table, includedHierarchy, this.i18nBundle, versions, excludeNodes);
			} else {
				this.selector.setTreeTableData(includedHierarchy, this.offerData.Versions);
			}

			this.table.attachToggleOpenState(function (e) {
				var params = {
					rowContext: e.getParameter("rowContext"),
					expanded: e.getParameter("expanded")
				};
				that.selector.asyncExpand(params);
			});

			var tablePlace = this.getView().byId("sideBarContent");
			tablePlace.addContent(this.table);

			var tableContent = this.getSideBarTable();
			this.contentModel.setProperty("/VersionCount", this.i18nBundle.getResourceBundle().getText("ManageVersions.SideBar.Title",
				tableContent.getModel().getData()[0].versionCount || "0"));
			tableContent.setSelectionBehavior(sap.ui.table.SelectionBehavior.RowOnly);
			tableContent.getModel().setSizeLimit(Utils.getSizeLimit());
			if (this.selector.data.length > tableContent.getVisibleRowCount()) {
				tableContent.setVisibleRowCount(this.selector.data.length);
				tableContent.refreshRows(true);
				tableContent.getModel().refresh(true);
			}

			//initial filter
			this.table.getBinding("rows");
		},

		openQuickView: function (oEvent) {

			var oPopover = oEvent.getSource().getParent().getAggregation("items")[0];
			oPopover.openBy(oEvent.getSource());

		},

		goBackToMainOffer: function (store) {
			// Go back if possible, otherwise go to offer
			var bBackAllowed = History.getInstance().getPreviousHash() !== undefined;
			this.isForSave = true;
			var oData = this.preparePayloadForSave(true, true);
			oData.Readonly = this.isDisplayMode;
			oData.LocationHierarchy = this.availableHierarchy;
			if (store) {
				this.state.store(oData);
			}
			this.getEventBus().publish("retail.pmr.promotionaloffers", "onVersionDataChange");
			this.state.storeBack(true);
			if (bBackAllowed) {
				window.history.go(-1);
			} else {
				// we don't have history
				var path = "edit";
				if (this.isDisplayMode) {
					path = "display";
				}
				this.getRouter().navTo(path, {
					path: Utils.base64ToHex(oData.OfferId)
				}, true);
			}
			this.cleanModel();
		},

		getEventBus: function () {
			return sap.ui.getCore().getEventBus();
		},

		_getPayload: function () {
			var general = this.generalController.getOfferData();
			var terms = this.termsController.getOfferData();
			var financials = this.termsController.getFinancials();
			var versionPayload = {};
			var termsProdWithFinancials = this.termsController.getTermsProductsFinancials();
			jQuery.extend(versionPayload, general, terms, {
				Financials: financials
			}, termsProdWithFinancials);
			return versionPayload;
		},

		isParent: function (node) {
			for (var i in node) {
				if (node.hasOwnProperty(i) && jQuery.isNumeric(i)) {
					return true;
				}
			}
			return false;
		},

		updateChildrenDates: function (payload, offer, parent, selectedTreeLocation) {
			var children = offer.Versions;
			if (selectedTreeLocation) {
				var parentId = payload.LocationNodeId;
				children = this.getChildren(selectedTreeLocation, parentId, offer);
			}
			for (var i = 0; i < children.length; i++) {
				if (children[i].StartOfOffer.getTime() === parent.StartOfOffer.getTime()) {
					children[i].StartOfOffer = payload.StartOfOffer;
				}
				if (children[i].EndOfOffer.getTime() === parent.EndOfOffer.getTime()) {
					children[i].EndOfOffer = payload.EndOfOffer;
				}
			}
		},

		getChildren: function (hierarchy, nodeId, offer) {
			var children = [];
			for (var i in hierarchy) {
				if (hierarchy.hasOwnProperty(i) && jQuery.isNumeric(i)) {
					var childLocation = createLocationSelected(null, hierarchy[i]);
					var versionChild = getVersionAsChild(offer.Versions, childLocation, this);
					if (versionChild) {
						children.push(versionChild);
					}

					if (this.isParent(hierarchy[i])) {
						this.getChildren(hierarchy[i], hierarchy[i].NodeId, offer);
					}
				}
			}
			return children;
		},

		getCurrentSelectedHierarchy: function (locationSelectedTree, nodeId) {
			var currentSelectedHier;
			for (var i in locationSelectedTree) {
				if (locationSelectedTree.hasOwnProperty(i) && jQuery.isNumeric(i)) {
					if (locationSelectedTree[i].NodeId === nodeId) {
						currentSelectedHier = locationSelectedTree[i];
						break;
					}
				}
			}
			return currentSelectedHier;
		},

		updateNodeDates: function (versions, node, payload) {
			var index = getVersionIndex(versions, node);
			if (index !== -1) {
				versions[index].StartOfOffer = payload.StartOfOffer;
				versions[index].EndOfOffer = payload.EndOfOffer;
			}
		},
		versionHasChanges: function (versionPayload) {
			var hasChanges = false;
			if (versionPayload && !versionPayload.Readonly) {
				var currentVersion = jQuery.extend(true, {}, versionPayload);
				delete currentVersion.isShowingParent;
				var index = getVersionIndex(this.changedVersions, currentVersion);
				if (this.getVersionSnapshot(currentVersion) && !jQuery.sap.equal(this.getVersionSnapshot(currentVersion), currentVersion)) {
					if (index === -1) {
						this.changedVersions.push(currentVersion);
					}
				} else {
					if (index !== -1) {
						this.changedVersions.splice(index, 1);
					}
				}
			}
			if ((this.changedVersions && this.changedVersions.length > 0) || this.aVersionWasDeleted) {
				hasChanges = true;
			} else {
				hasChanges = false;
			}
			return hasChanges;
		},
		getVersionSnapshot: function (versionPayload) {
			var index = getVersionIndex(this.versionsSnapshot, versionPayload);
			if (index !== -1 && this.versionsSnapshot[index]) {
				delete this.versionsSnapshot[index].isShowingParent;
				return this.versionsSnapshot[index];
			} else {
				return null;
			}

		},
		updateVersion: function (payload, cloneOffer) {

			var offer = this.offerData;

			if (cloneOffer) {
				offer = cloneOffer;
			}
			var oldOffer = jQuery.extend(true, {}, offer);
			if ((this.locationSelected && this.locationSelected.isTopLevel) || !this.locationSelected) {
				this.updateMainOffer(payload, offer);
				this.updateChildrenDates(payload, offer, oldOffer);
				return;
			}

			if (this.isNoVersion) {
				return;
			}

			var index = getVersionIndex(offer.Versions, this.originalSelectedVersion);
			if (index !== -1) {
				offer.Versions[index] = jQuery.extend({}, offer.Versions[index], payload);
				var termsPayload = payload.Terms;
				offer.Versions[index].Terms = termsPayload;
			} else {
				offer.Versions.push(payload);
				index = offer.Versions.length - 1;
			}
			var locationSelectedTree = this.locationSelected.objectLocationTree;
			var nodeId = this.locationSelected.LocationNodeId;
			var currentSelectedTree = this.getCurrentSelectedHierarchy(locationSelectedTree, nodeId);
			if (currentSelectedTree && index !== -1) {
				var parent = oldOffer.Versions[index];
				this.updateChildrenDates(payload, offer, parent, currentSelectedTree);
			}

		},

		updateMainOffer: function (payload, offer) {
			for (var key in payload) {
				offer[key] = payload[key];
			}

			if (this.pathName === "versionCreate") {
				offer.ExtLocationNodeId = this.ExtLocationNodeId;
			}
		},

		cleanPayloadForSave: function (versionPayload, softClean, offer) {
			if (!softClean) {
				delete versionPayload.Readonly;
				delete versionPayload.Financials;
				delete versionPayload.locationPath;
				if (this.locationSelected && !this.locationSelected.isTopLevel) {
					delete versionPayload.ExtLocationNodeId;
					delete versionPayload.Editable;
					versionPayload.UnitProjection = parseFloat(versionPayload.UnitProjection) + "";
				}
				versionPayload.Terms.forEach(function (term) {
					//delete term.TermId;
					delete term.OfferId;
					if (parseFloat(term.DiscountValue) === 0) {
						delete term.DiscountValue;
					}
					if (parseFloat(term.SubDiscountValue) === 0) {
						delete term.SubDiscountValue;
					}
					if (term.LockUserProjection === false) {
						delete term.LockUserProjection;
					}
					if (this.removeFinancial) {
						delete term.Financials;
						term.Financials = {
							Id: ""
						};
					}

					delete term.DiscountTypeName;
					if (this.removeFinancial) {
						delete term.Financials;
						term.Financials = {
							Id: ""
						};
					}
					this.cleanProductsFinancials(term.TermProducts);
				}.bind(this));
				this.clearOfferForSave(offer ? offer : this.offerData);
			}
			delete versionPayload.isShowingParent;
			delete versionPayload.ShowEdit;
			return versionPayload;
		},

		clearOfferForSave: function (offer) {
			delete offer.Readonly;
			delete offer.VersionItems;
			delete offer.PurchasingGroupName;
			offer.Financials = [{}];
			if (offer.LocationHierarchy) {
				offer.LocationHierarchy.forEach(function (item) {
					delete item.checked;
					delete item.expanding;
					delete item.N_ID;
					delete item.P_ID;
				});
			}
			if (offer.Terms) {
				offer.Terms.forEach(function (term) {
					if (term) {
						//delete term.TermId;
						delete term.OfferId;
						if (parseFloat(term.DiscountValue) === 0) {
							delete term.DiscountValue;
						}
						if (parseFloat(term.SubDiscountValue) === 0) {
							delete term.SubDiscountValue;
						}
						if (term.LockUserProjection === false) {
							delete term.LockUserProjection;
						}
						if (this.removeFinancial) {
							delete term.Financials;
							term.Financials = {
								Id: ""
							};
						}

						delete term.DiscountTypeName;
						this.cleanProductsFinancials(term.TermProducts);
					}
				}.bind(this));
			}
			this.addEmptyArrays(offer, "Incentives");
			this.addEmptyArrays(offer, "LocalNodes");
			this.addEmptyArrays(offer, "Terms");
			this.addEmptyArrays(offer, "VendorFunds");
			this.addEmptyArrays(offer, "Versions");
			this.addOrRemovePropertiesAllVersions(true, true, offer);
		},

		addEmptyArrays: function (offer, nameArray) {
			if (!offer[nameArray]) {
				offer[nameArray] = [];
			}
		},

		/**
		 * save in memory only
		 */
		saveShadowVersion: function () {
			var versionPayload = this._getPayload();
			this.updateVersion(this.cleanPayloadForSave(versionPayload, true));
		},

		cleanModel: function () {
			this.locationSelected = null;
			this.offerData = null;
			if (this.table) {
				this.table.destroy(true);
				this.table = null;
			}
			this.currentPath = null;
			this.expandedPaths = [];
			this.contentModel.setProperty("/HideExcludedNodes", false);
			this.afterSave = false;
			this.isAfterDeleteOrAdd = false;
		},

		preparePayloadForSave: function (saveOffer, cloneOffer) {

			var offer = this.offerData;
			if (cloneOffer) {
				offer = jQuery.extend(true, {}, this.offerData);
			}
			var versionPayload = this._getPayload();
			if (this.isForSave || this.calcFinancials || this.pathName === "versionCreate") {
				this.updateVersion(this.cleanPayloadForSave(versionPayload, false, offer), offer);
				if (!saveOffer) {
					if (offer.Versions) {
						offer.Versions.forEach(function (version) {
							delete version.isShowingParent;
							if (version.Description === "") {
								delete version.Description;
							}
						});
					}
					var that = this;
					if (this.pathName === "versionCreate" && offer.Tactics && offer.Tactics.length > 0) {
						offer.Tactics.forEach(function (tactic) {
							if (tactic && !tactic.TacticDesc && !tactic.TacticTypeDesc) {
								var allTactics = that.staticData.Tactics;
								for (var i = 0; i < allTactics.length; i++) {
									if (allTactics[i].TacticId === tactic.TacticId && allTactics[i].TacticType === tactic.TacticType) {
										tactic.TacticDesc = allTactics[i].TacticDesc;
										tactic.TacticTypeDesc = allTactics[i].TacticTypeDesc;
										break;
									}
								}
							}
						});
					}
				} else {
					for (var i = 0; i < (offer.Versions || []).length; i++) {
						var version = offer.Versions[i];
						delete version.LocalNodes;
					}

					// this because ParentId is invalid	
					delete offer.LocationHierarchy;
				}
			}

			this.isForSave = false;
			this.removeFinancial = false;
			this.calcFinancials = false;
			(offer.Versions || []).forEach(function (version) {

				if (version.Tactics && version.Tactics.length === 0) {
					delete version.Tactics;
				}
			});
			return offer;
		},
		validateVersionsListener: function (channel, event, context) {
			this.versionsValid();
		},

		setUserLocationIdForUserNodes: function () {
			if (!this.locationSelected) {
				return;
			}
			(this.offerData.LocalNodes || []).some(function (item) {
				if (this.locationSelected.ExtLocationId === item.Description) {
					this.locationSelected.LocationNodeId = item.Id;
					return true;
				}
			}.bind(this));
		},

		/**
		 * Triggered when pressing the save button.
		 *
		 * @returns {void}
		 */
		onSave: function () {

			this.oMessageManager.removeAllMessages();
			if (!this.verifyValidation()) {
				return;
			}

			if (!this.versionsValid()) {
				return;
			}

			var oBundle = this.getView().getModel("i18n").getResourceBundle();

			this.isForSave = true;
			this.removeFinancial = true;
			return this.state.save().then(
				function (oResponse) {
					Utils.getErrorHandler().showToast(oBundle.getText("CreateOffer.ToastMessage.SaveCompleted"));

					this.offerData = jQuery.extend(true, {}, this.state.getOfferData());
					this.setUserLocationIdForUserNodes();
					var currentLocation = this.locationSelected;
					if (!this.locationSelected) {
						currentLocation = getParentByPath(this.getSideBarTable(), "/0", true);
					}
					var versionData = getVersionSelected(this.offerData.Versions, currentLocation, this);
					var versionPathToNav = "versionEdit";

					if (Utils.isReadOnly({
							Status: this.offerData.Status,
							UIState: this.offerData.UIState
						})) {
						versionPathToNav = "versionDisplay";
						this.isDisplayMode = true;
						(this.offerData.Versions || []).forEach(function (version) {
							version.Readonly = true;
						});
						this.offerData.Readonly = true;
						if (versionData) {
							versionData.Readonly = true;
						}
					}

					this.afterSave = true;
					this.setVersionData(this.offerData, this.staticData, null, versionData, true);
					this.getRouter().navTo(versionPathToNav, {
						path: Utils.base64ToHex(this.offerData.OfferId),
						id: versionData && versionData.OfferId ? Utils.base64ToHex(versionData.OfferId) : Utils.base64ToHex(this.offerData.OfferId)
					}, true);

					Utils.getErrorHandler().showToast(this.i18nBundle.getResourceBundle().getText("CreateOffer.ToastMessage.SaveCompleted"));
					return versionData || this.offerData;
				}.bind(this),
				function (oError) {
					Utils.getErrorHandler().showError(oBundle.getText("CreateOffer.ErrorMessage.Save"));
				}
			);
		},

		versionsValid: function () {
			var data = this.state.getSavePayloadWithFinancials();
			var allErrors = [];
			var aItems = data.Versions;
			if (aItems && aItems.length > 0) {
				for (var i = 0; i < aItems.length; i++) {
					if (!Utils.isInOfferRange(aItems[i], data.StartOfOffer, data.EndOfOffer, this.offerData)) {
						allErrors.push({
							target: "/invalidVersion",
							type: "Error",
							processor: this.dataModel,
							message: this.i18nBundle.getResourceBundle().getText("Versions.Not.In.Range.Title.Error", aItems[i].Name),
							description: this.i18nBundle.getResourceBundle().getText("Versions.Not.In.Range.Message.Error", aItems[i].Name)
						});
					}
				}
			}
			Utils.removeMessagesByPath("/invalidVersion");
			Utils.setErrorMessages(Utils.getMessageManager(), allErrors);

			return !allErrors.length;
		},
		verifyValidation: function () {
			var tabs = [];
			var versionData = this._getPayload();
			if (versionData.Readonly) {
				return true;
			}

			if (this.generalController.validateForm()) {
				tabs.push(this.i18nBundle.getResourceBundle().getText("CreateVersion.General.Title"));
			}

			if (this.termsController.validateForm()) {
				tabs.push(this.i18nBundle.getResourceBundle().getText("CreateOffer.Terms.Title"));
			}

			if (tabs.length) {
				var sMsg = this.i18nBundle.getResourceBundle().getText("CreateOffer.SaveOffer.Validate", tabs.join(", "));
				Utils.getErrorHandler().showError(sMsg);
				return false;
			}

			return true;
		},

		/**
		 * Fired when pressing delete button on version display.
		 *
		 * @returns {void}
		 */
		onDeleteVersionPress: function () {
			if ((this.locationSelected && this.locationSelected.isTopLevel) || !this.locationSelected) {
				return;
			}
			var dialogProperties = {
				"massageSingle": "ManageVersions.DeleteSingleVersionDialog.Message",
				"messageMulti": "ManageVersions.DeleteVersionDialog.Message",
				"title": "ManageVersions.DeleteVersionDialog.Title"
			};
			Utils.openDeleteConfirmDiaog(true, dialogProperties).then(function () {
				this.onLoadingPage(true, false);
				var index = getVersionIndex(this.offerData.Versions, this.originalSelectedVersion);
				this.offerData.Versions.splice(index, 1);
				this.removeLocalNodes(this.originalSelectedVersion.ExtLocationNodeId || this.locationSelected.ExtLocationId);
				var parentVersion = getVersionSelected(this.offerData.Versions, this.locationSelected, this);
				if (parentVersion) {
					parentVersion.Readonly = true;
				}
				this.isAfterDeleteOrAdd = true;
				this.setVersionData(this.offerData, this.staticData, null, parentVersion, true);

			}.bind(this));
		},

		/**
		 * Fired when pressing restore button on version display.
		 *
		 * @returns {void}
		 */
		onRestoreVersionPress: function () {
			if ((this.locationSelected && this.locationSelected.isTopLevel) || !this.locationSelected) {
				return;
			}
			var dialogProperties = {
				"massageSingle": "ManageVersions.RestoreVersionDialog.Message",
				"messageMulti": "ManageVersions.RestoreVersionDialog.Message",
				"title": "ManageVersions.RestoreVersionDialog.Title",
				"confirmLabel": "ManageVersions.RestoreVersionDialog.Restore"
			};
			Utils.openDeleteConfirmDiaog(true, dialogProperties).then(function () {
				this.onLoadingPage(true, false);
				this.restoreVersion = true;
				var index = getVersionIndex(this.offerData.Versions, this.originalSelectedVersion);
				var parentLocation = getParentByPath(this.getSideBarTable(), this.locationSelected.path);
				var parentVersion = getVersionSelected(this.offerData.Versions, parentLocation, this);
				var currentVersion = this.getVersionData(parentVersion);
				(currentVersion.Terms || []).forEach(function (term) {
					term.UserProjection = null;
				});

				var tree = this.locationSelected.objectLocationTree;
				var currentLocation = this.locationSelected;
				var matchingNodes = Utils.findInTree(tree, function (item) {
					return item.ExtNodeId === currentLocation.ExtLocationId;
				});
				if (matchingNodes.length > 0) {
					var versionName = null;
					if (matchingNodes[0].VersionName) {
						versionName = matchingNodes[0].VersionName;
					} else if (currentLocation.Name) {
						versionName = currentLocation.Name + " (" + currentLocation.ExtLocationId + ")";
					} else {
						versionName = matchingNodes[0].NodeName;
					}
					currentVersion.Name = versionName;
				} else {
					currentVersion.Name = currentLocation.Name + " (" + currentLocation.ExtLocationId + ")";
				}

				this.offerData.Versions[index] = currentVersion;
				this.restoreVersion = false;
				this.setVersionData(this.offerData, this.staticData, null, currentVersion, true);
			}.bind(this));
		},

		/**
		 * Fired when pressing edit button on version display.
		 *
		 * @returns {void}
		 */
		onEditVersionPress: function () {
			if (!this.offerData.Editable) {
				Utils.createDialogUtil({
					btnOk: "{i18n>Offer.OK}",
					message: "{i18n>ManageOffers.offerNotEditable}",
					state: "Error",
					view: this.getView(),
					onOk: function (resolve) {
						resolve();
					}
				}).then(function () {});
				return;
			}
			this.onLoadingPage(true, false);
			var versionData = this._getPayload();
			delete versionData.Readonly;
			this.getRouter().navTo("versionEdit", {
				path: Utils.base64ToHex(this.offerData.OfferId),
				id: versionData.OfferId ? Utils.base64ToHex(versionData.OfferId) : Utils.base64ToHex(this.offerData.OfferId)
			}, true);
			this.isDisplayMode = false;
			this.offerData.Versions.forEach(function (version) {
				delete version.Readonly;
			});
			delete this.offerData.Readonly;
			this.setVersionData(this.offerData, this.staticData, null, versionData, false);
			this.createSnapshot();
		},

		addOrRemovePropertiesAllVersions: function (isEnabled, isClean, snapshot) {
			var that = this;
			var offer = this.offerData;
			if (snapshot) {
				offer = snapshot;
			}
			if (offer.Versions) {
				offer.Versions.forEach(function (version) {
					if (isClean) {
						delete version.Readonly;
						if (version.LocationId) {
							version.LocationNodeId = version.LocationId;
						}
						delete version.isShowingParent;
						delete version.LocationId;
						delete version.ShowEdit;
						delete version.Financials;
						delete version.locationPath;
						version.UnitProjection = parseFloat(version.UnitProjection) + "";
						if (version.Terms) {
							version.Terms.forEach(function (term) {
								//delete term.TermId;
								delete term.OfferId;
								if (parseFloat(term.DiscountValue) === 0) {
									delete term.DiscountValue;
								}
								if (parseFloat(term.SubDiscountValue) === 0) {
									delete term.SubDiscountValue;
								}
								if (term.LockUserProjection === false) {
									delete term.LockUserProjection;
								}
								if (this.removeFinancial) {
									delete term.Financials;
									term.Financials = {
										Id: ""
									};
								}

								delete term.DiscountTypeName;
								that.cleanProductsFinancials(term.TermProducts);

							}.bind(that));
						}
						if (version.Terms && version.Terms.length === 0) {
							delete version.Terms;
						}
					} else {
						version.Readonly = isEnabled;
					}
				});
			}
		},

		cleanProductsFinancials: function (products) {
			if (products) {
				products.forEach(function (product) {
					if (this.removeFinancial) {
						delete product.Financials;
						product.Financials = {
							Id: ""
						};
					}
					if (!product.Financials) {
						product.Financials = {
							Id: ""
						};
					}
					if (parseFloat(product.DiscountValue) === 0) {
						product.DiscountValue = "0";
					}
					if (parseFloat(product.SubDiscountValue) === 0) {
						product.SubDiscountValue = "0";
					}
					delete product.Id;
				}.bind(this));
			}
		},

		selectATreeRow: function (index, freshSelect) {
			this.isAlreadySelected = true;
			this.refreshTableOnExcludeSwitch = false;
			if (freshSelect) {
				this.isAlreadySelected = false;
				this.refreshTableOnExcludeSwitch = true;
			}
			this.getSideBarTable().setSelectedIndex(index);
		},

		getLocationTextForNodes: function (index) {
			var context = this.getSideBarTable().getContextByIndex(index);
			if (!context) {
				return;
			}
			var object = context.getObject();

			return object.ExtLocationId || object.ExtNodeId;
		},

		reselectVersion: function (isParent) {
			var tableContent = this.getSideBarTable();
			var index = getIndexByPath(tableContent, this.locationSelected && !isParent ? this.locationSelected.path : "/0");
			this.selectATreeRow(index, isParent);
		},

		/**
		 * this will select the version displayed and return her context used for user nodes
		 */
		selectCurrentVersionDisplayed: function (selectedVersion) {
			var tableContent = this.getSideBarTable();
			var selectedPath = getPathByLocationId(tableContent, selectedVersion.LocationNodeId || selectedVersion.LocationId ||
				selectedVersion.ExtLocationNodeId);
			tableContent.collapseAll();
			expandTreeTableByPath(tableContent, selectedPath);
			var index = getIndexByPath(tableContent, selectedPath);
			this.selectATreeRow(index);
			var context = tableContent.getContextByIndex(index);
			return context;
		},

		removeParentIdsOnNewVersion: function (newVersion, parentVersion) {
			delete newVersion.LocalNodes;
			delete newVersion.LocationHierarchy;
			delete newVersion.Versions;
			delete newVersion.OfferId;
			if (newVersion.Terms && this.locationSelected && !this.locationSelected.isTopLevel) {
				(newVersion.Incentives || []).forEach(function (incentive) {
					incentive.Id = "";
				});
				newVersion.Terms.forEach(function (term) {
					if (term) {
						delete term.TermId;
						if (term.Financials) {
							delete term.Financials.Id;
						}
						delete term.OfferId;
					}
				});
			} else {
				newVersion.Incentives = parentVersion.Incentives;
				newVersion.Terms = parentVersion.Terms;
			}
			return newVersion;
		},

		isOfferStatusApproved: function () {
			var isApproved = false;
			var offerSnapshot = this.state.processor.getSnapshot();
			if (Utils.isReadOnly({
					Status: offerSnapshot.Status,
					UIState: offerSnapshot.UIState
				}) && (isEmpty(offerSnapshot) || !offerSnapshot.Status || (!isEmpty(offerSnapshot) && this.offerData.Status === offerSnapshot.Status) ||
					this.afterSave)) {
				isApproved = true;
			}
			return isApproved;
		},

		getVersionData: function (selectedVersion, localNodes) {
			var version = {};
			var startDate = this.offerData.StartOfOffer;
			var endDate = this.offerData.EndOfOffer;
			if (selectedVersion) {
				startDate = selectedVersion.StartOfOffer;
				endDate = selectedVersion.EndOfOffer;
			}
			var extOfferId;
			if (selectedVersion) {
				extOfferId = selectedVersion.ExtOfferId || "";
				jQuery.extend(true, version, selectedVersion);
				if (selectedVersion.isShowingParent && this.addNewVersion) {
					version = this.removeParentIdsOnNewVersion(version, selectedVersion);
				}
			} else {
				extOfferId = this.offerData.ExtOfferId || "";
				jQuery.extend(true, version, this.offerData);
				if (this.locationSelected && this.addNewVersion) {
					this.locationSelected.isTopLevel = false;
				}
				version = this.removeParentIdsOnNewVersion(version, this.offerData);
			}
			var newName = this.locationSelected ? this.locationSelected.ExtLocationId : "";
			if (this.locationSelected && this.locationSelected.Name) {
				newName = this.locationSelected.Name + " (" + newName + ")";
			}
			version.Name = this.addNewVersion ? newName : !selectedVersion ? this.offerData.Name : selectedVersion.Name;
			version.EndOfOffer = endDate;
			version.StartOfOffer = startDate;
			version.ExtOfferId = this.addNewVersion ? "" : extOfferId;
			version.Readonly = !selectedVersion && !this.locationSelected ? this.offerData.Readonly : this.addNewVersion || this.restoreVersion ?
				false : !selectedVersion ? !this.locationSelected || (this.locationSelected && this.locationSelected.isTopLevel) ? this.isDisplayMode :
				true : selectedVersion.Readonly;

			version.ShowEdit = ((selectedVersion && !selectedVersion.isShowingParent) || (this.locationSelected && this.locationSelected.isTopLevel) ||
				!this.locationSelected) && version.Readonly && !this.isOfferStatusApproved() ? true : false;

			if (selectedVersion && !this.locationSelected) {
				var context = this.selectCurrentVersionDisplayed(selectedVersion);
				this.locationSelected = createLocationSelected(context);
			}

			if (localNodes) {
				if (localNodes[0].LocationNodeId) {
					version.HierarchyId = localNodes[0].HierarchyId;
					version.LocationNodeId = localNodes[0].LocationNodeId;
				} else {
					delete version.LocationNodeId;
					localNodes[0].Id = "";
					version.HierarchyId = localNodes[0].HierarchyId;
					delete localNodes[0].HierarchyId;
					version.ExtLocationNodeId = localNodes[0].Description;
					this.addLocalNodes(localNodes);
				}
			} else {
				var topLevelExtLocationNodeId = getLocationNodeName(this.getSideBarTable(), this.offerData.LocationNodeId);
				if (this.locationSelected) {
					var selectedHierarchyId = this.locationSelected.HierarchyId ? this.locationSelected.HierarchyId : this.offerData.HierarchyId;
					var locationNodeIdResult = this.locationSelected.LocationNodeId || this.locationSelected.ExtLocationId;
					var selectedLocationNodeId = this.restoreVersion ? locationNodeIdResult : !selectedVersion ? this.offerData.LocationNodeId :
						selectedVersion.LocationNodeId;
					var locationNodeName = getLocationNodeName(this.getSideBarTable(), selectedLocationNodeId) || this.locationSelected.ExtLocationId;
					var selectedVersionExtLocationNodeId = selectedLocationNodeId ? locationNodeName : selectedVersion.ExtLocationNodeId;
					var selectedExtLocationNodeId = this.restoreVersion ? locationNodeName : !selectedVersion ? topLevelExtLocationNodeId :
						selectedVersionExtLocationNodeId;
					version.HierarchyId = !selectedVersion ? this.offerData.HierarchyId : selectedHierarchyId;
					version.LocationNodeId = this.addNewVersion ? this.locationSelected.LocationNodeId : selectedLocationNodeId;
					version.ExtLocationNodeId = this.addNewVersion ? this.locationSelected.ExtLocationId : selectedExtLocationNodeId;
				} else {
					version.HierarchyId = !selectedVersion ? this.offerData.HierarchyId : selectedVersion.HierarchyId;
					version.LocationNodeId = !selectedVersion ? this.offerData.LocationNodeId : selectedVersion.LocationNodeId || selectedVersion.LocationId;
					version.ExtLocationNodeId = !selectedVersion ? topLevelExtLocationNodeId : selectedVersion.ExtLocationNodeId;
				}
			}

			var isLocalLocationNode = false;

			if (this.offerData.LocalNodes) {
				isLocalLocationNode = this.offerData.LocalNodes.some(function (node) {
					return node.Description === version.LocationNodeId && node.Id === "";
				});
			}

			if (isLocalLocationNode) {
				delete version.LocationNodeId;
			}

			return version;
		},

		addLocalNodes: function (localNodes) {
			if (!this.offerData.LocalNodes) {
				this.offerData.LocalNodes = [];
			}
			var index = this.offerData.LocalNodes.indexOf(localNodes[0]);
			if (index === -1) {
				this.offerData.LocalNodes.push(localNodes[0]);
			}
		},

		removeLocalNodes: function (ExtLocationNodeId) {
			var isUserCreateNode = false;
			if (this.offerData.LocalNodes) {
				for (var i = 0; i < this.offerData.LocalNodes.length; i++) {
					if (this.offerData.LocalNodes[i].Description === ExtLocationNodeId) {
						this.offerData.LocalNodes.splice(i, 1);
						isUserCreateNode = true;
					}
				}
			}
			this.removeLocalNodesFromVersionLevel(ExtLocationNodeId);
			return isUserCreateNode;
		},

		removeLocalNodesFromVersionLevel: function (ExtLocationNodeId) {
			if (this.offerData.Versions) {
				var versions = this.offerData.Versions;
				versions.forEach(function (version) {
					if (version.LocalNodes && version.LocalNodes.Description === ExtLocationNodeId) {
						delete version.LocalNodes;
					}
				});
			}
		},

		setVersionData: function (offer, staticData, localNodes, selectedVersion, refreshSideBar) {
			this.originalSelectedVersion = {};
			this.originalSelectedVersion = selectedVersion;
			this.staticData = staticData;
			this.isNoVersion = !selectedVersion ? true : false;
			this.addEmptyArrays(offer, "Versions");
			this.offerData = {};
			jQuery.extend(true, this.offerData, offer);
			if (!offer.LocationHierarchy || (offer.LocationHierarchy && offer.LocationHierarchy.length < 1) || (offer.LocationHierarchy &&
					offer.LocationHierarchy.length > 0 && !offer.LocationHierarchy[0].Cardinality && offer.LocationHierarchy[0].Locations && offer.LocationHierarchy[
						0].Locations.length < 1)) {
				offer.LocationHierarchy = this.availableHierarchy;
			}
			this.availableHierarchy = offer.LocationHierarchy.slice();
			offer.LocationHierarchy = Utils.buildLocationHierarchyFromVH(offer.LocationHierarchy);
			var versionsHelper = new VersionsHelper(offer);

			if (!this.locationSelected && !this.table) {
				this.onLoadingPage(true, false, true);
				this.isDisplayMode = this.pathName === "versionDisplay" ? true : false;
				if (this.pathName === "versionCreate") {
					var parentLocation = this.offerData.LocationHierarchy[0];
					this.ExtLocationNodeId = parentLocation.ExtHierarchyId;
				}
			}

			this.expandedPaths = [];
			if (refreshSideBar) {
				this.hierarchy = versionsHelper.getHierarchy()[0];
				var expandedNodes = this.table ? getExpandedNodes(this.getSideBarTable()) : null;
				this.expandedPaths = expandedNodes && !this.isUserNodeCreated ? expandedNodes.paths : ["/0"];
				this.isAlreadySelected = true;
				this.isUserNodeCreated = false;
				this.createSideBarTable(this.hierarchy, offer.Versions, offer.ExcludedNodes || []);
				jQuery.sap.delayedCall(0, this, function () {
					this.expandedPaths.forEach(function (path) {
						if (path) {
							expandTreeTableByPath(this.getSideBarTable(), path, true);
						}
					}.bind(this));
				});
			}
			jQuery.sap.delayedCall(0, this, function () {
				this.setData(offer, selectedVersion, staticData, this.expandedPaths, refreshSideBar);
			});
		},

		onLoadingPage: function (isLoading, creatingMode, loadingPage) {
			if (isLoading) {
				Utils.getErrorHandler().showBusy();
			} else {
				jQuery.sap.delayedCall(300, this, Utils.getErrorHandler().hideBusy());
			}
		},

		setData: function (offer, selectedVersion, staticData, expandedPaths, isRefresh) {
			this.reselectVersion();
			var versionData = {};
			versionData = this.getVersionData(selectedVersion);
			if (isRefresh) {
				var index = getIndexByPath(this.getSideBarTable(), this.locationSelected ? this.locationSelected.path : "/0");
				this.currentIndex = index;
				this.currentPath = this.locationSelected ? this.locationSelected.path : "/0";
				if (this.isNewVersion) {
					var newVersion = jQuery.extend(true, {}, versionData);
					newVersion.isNew = true;
					this.isNewVersion = false;
					this.isAfterDeleteOrAdd = true;
				}

			}
			var showSideBar = this.contentModel.getProperty("/ShowVesionList");
			var isPhone = this.contentModel.getProperty("/isPhone");

			this.contentModel.setData({
				Editable: !versionData.Readonly,
				NavButtonsEnabled: !versionData.Readonly,
				ShowEdit: versionData.ShowEdit,
				ShowVesionList: showSideBar,
				isPhone: isPhone,
				showVersionActions: !((this.locationSelected && this.locationSelected.isTopLevel) || !this.locationSelected),
				LeadOfferName: offer.Name,
				FullHierarchy: this.contentModel.getProperty("/FullHierarchy"),
				IncludedHierarchy: this.contentModel.getProperty("/IncludedHierarchy"),
				HideExcludedNodes: this.contentModel.getProperty("/HideExcludedNodes")
			});

			this.contentModel.setProperty("/SplitParentWidth", 0);
			this.contentModel.setProperty("/ToggleSplitPanePressed", false);
			this.contentModel.setProperty("/CollisionEnabled", false);
			this.contentModel.setProperty("/VersionCount", this.i18nBundle.getResourceBundle().getText("ManageVersions.SideBar.Title",
				this.getSideBarTable().getModel().getData()[0].versionCount || "0"));
			this.dataModel.setData(versionData);
			var result = Utils.setupFeatures(staticData.FeaturesAvailable);
			this.featureModels.setData(result);
			offer.selectedVersion = selectedVersion;
			offer.hierarchy = this.hierarchy;
			offer.isTopLevel = !this.locationSelected || (this.locationSelected && this.locationSelected.isTopLevel);
			this.generalController.setOfferData(versionData, staticData, offer);
			this.termsController.setGeneralDataModel({
				getDataModel: function () {
					return this.generalController.dataModel;
				}.bind(this)
			});
			this.termsController.setRouter(this.getRouter());

			if (!versionData.Terms) {
				versionData.Terms = [];
			}
			versionData.LocationSubgroups = offer.LocationSubgroups;
			this.termsController.setOfferData(versionData, staticData);

			if (versionData.Financials) {
				this.termsController.setFinancials(versionData.Financials);
			}
			this.staticData = staticData;
			if ((!offer.Editable || this.isOfferStatusApproved()) && this.pathName === "versionEdit") {
				var errorMessageText = "{i18n>ManageOffers.offerNotEditable}";
				if (this.isOfferStatusApproved()) {
					errorMessageText = "{i18n>ManageOffers.offerNotEditableIsApproved}";
				}
				Utils.createDialogUtil({
					title: "{i18n>ManageOffers.OfferFunctionsErrorDialog.Title}",
					btnOk: "{i18n>Offer.OK}",
					message: errorMessageText,
					state: "Error",
					view: this.getView(),
					onOk: function (resolve) {
						resolve();
					}
				}).then(function () {
					this.getRouter().navTo("versionDisplay", {
						path: Utils.base64ToHex(this.offerData.OfferId),
						id: versionData.OfferId ? Utils.base64ToHex(versionData.OfferId) : Utils.base64ToHex(this.offerData.OfferId)
					}, true);
					this.isDisplayMode = true;
					this.offerData.Versions.forEach(function (version) {
						version.Readonly = true;
					});
					this.offerData.Readonly = true;
					versionData.Readonly = true;
					this.setVersionData(this.offerData, this.staticData, null, versionData, false);
				}.bind(this));
			}
			jQuery.sap.delayedCall(0, this, function () {
				if (this.afterSave) {
					this.isAfterDeleteOrAdd = false;
					this.createSnapshot();
					this.afterSave = false;
				} else {
					var currentSnapshot = this.state.processor.getSnapshot();
					this.clearOfferForSave(currentSnapshot);
					this.state.processor.storeSnapshot(currentSnapshot);
				}
				this.state.storeTransientSnapshot();
				this.makeButtonsVisible();
				this.onLoadingPage(false, false);
			});
			this.makeButtonsVisible();
		},

		createSnapshot: function (channel, event, context) {
			var updateSnapshot = true;
			var currentSnapshot = jQuery.extend({}, true, this.state.processor.getSnapshot());
			this.isForSave = true;
			var snapshot = jQuery.extend({}, true, this.state.processor.createSavePayload());
			this.removeFinancial = true;

			/* after all Products term are updated 
			the snapshot is created again and stored - only the term products are changed in the snapshot new created 
			*/
			if (context) {
				var newTerms = snapshot.Terms;
				var oldTerms = currentSnapshot.Terms;
				if (oldTerms && newTerms && oldTerms.length !== newTerms.length) {
					updateSnapshot = false;
				} else {
					this.updateSnapshotTermProducts(snapshot, currentSnapshot);
				}
			}
			if (!this.isAfterDeleteOrAdd && updateSnapshot) {
				this.clearOfferForSave(currentSnapshot);
				this.clearOfferForSave(snapshot);
				this.state.processor.storeSnapshot(snapshot);
				this.makeButtonsVisible();
			}
			this.removeFinancial = false;
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
			var updateWitoutTerms = function (_snapshot, _oldSnapshot) {
				for (var key in _snapshot) {
					if (key !== "Terms" && key !== "Versions") {
						_snapshot[key] = _oldSnapshot[key];
					} else if (key === "Terms") {
						var newTerms = _snapshot[key];
						var oldTerms = _oldSnapshot[key];
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
			};
			updateWitoutTerms(snapshot, oldSnapshot);
			if (snapshot && snapshot.Versions) {
				(snapshot.Versions || []).forEach(function (version) {
					if (oldSnapshot.Versions) {
						var index = getVersionIndex(oldSnapshot.Versions, version);
						if (index !== -1) {
							updateWitoutTerms(version, oldSnapshot.Versions[index]);
						}
					}
				});
			}
		},
		availableNodes: function (data, tree) {
			if (!tree.versionCount || tree.versionCount < 1) {
				data.nr++;
			}
			for (var j in tree) {
				if (jQuery.isNumeric(j) && !tree.userCreatedNode) {
					this.availableNodes(data, tree[j]);
				}
			}
		},

		makeButtonsVisible: function () {
			var visibleSave = this.contentModel.getProperty("/NavButtonsEnabled");
			var visibleAddSingle = true;
			var otherVisibleDescription = false;
			var that = this;
			var data = {
				nr: 0
			};
			this.availableNodes(data, this.selector.hierarchy[0]);
			if (this.offerData && this.offerData.LocalNodes) {
				this.offerData.LocalNodes.forEach(function (localNode) {
					if (localNode) {
						if (that.locationSelected && localNode.Description === that.locationSelected.ExtLocationId) {
							visibleAddSingle = false;
						}
						(localNode.Children || []).forEach(function (child) {
							if (that.locationSelected && child.NodeId === that.locationSelected.LocationNodeId) {
								visibleAddSingle = false;
								otherVisibleDescription = true;

							}
						});
					}
				});
			}

			if ((this.originalSelectedVersion && !this.originalSelectedVersion.isShowingParent) || !this.locationSelected || (this.locationSelected &&
					this.locationSelected.isTopLevel)) {
				visibleAddSingle = false;
			}
			if (!shouldExitDirectly(hasChanges(this), this.isDisplayMode)) {
				visibleSave = true;
			}
			if (this.locationSelected && (this.locationSelected.isClosed || this.locationSelected.isExcluded)) {
				visibleAddSingle = false;
				otherVisibleDescription = true;
			}
			if (data.nr < 2) {
				visibleAddSingle = false;
			}
			this.contentModel.setProperty("/VisibleAddSingle", visibleAddSingle);
			this.contentModel.setProperty("/VisibleSave", visibleSave);
			this.contentModel.setProperty("/ShowAddActions", !this.isDisplayMode);
			this.contentModel.setProperty("/ShowDescription", this.isDisplayMode || (!this.isDisplayMode && (visibleAddSingle ||
				otherVisibleDescription)));
			this.contentModel.setProperty("/ShowFooter", !this.isDisplayMode || Utils.errorMessagesExists());
		},

		removeEmptyTermsBeforeFinancialCalc: function (payload) {
			if (payload.Terms && payload.Terms.length < 1) {
				delete payload.Terms;
			}
			payload.Versions.forEach(function (version) {
				if (version.Terms && version.Terms.length < 1) {
					delete version.Terms;
				}
				delete version.locationPath;
			});
			delete payload.LocationHierarchy;
			delete payload.Financials;
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
						//	Utils.navToEditOffer(this.getRouter(), this.state.getOfferData(), true);
						}
					}
					this.onLoadingPage(false, true);
				}.bind(this));
			}.bind(this), fnError);
		},

		handleCalcFinancialsPress: function () {
			var locationHierarchy = jQuery.extend([], true, this.offerData.LocationHierarchy);
			this.calcFinancials = true;
			this.removeFinancial = true;
			var payload = this.state.getSavePayloadWithFinancials();
			if (payload === null) {
				return;
			}

			this.removeEmptyTermsBeforeFinancialCalc(payload);
			this.offerData = jQuery.extend(true, {}, payload);
			var selectedVersion = null;
			var index = getVersionIndex(this.offerData.Versions, this._getPayload());
			var that = this;
			this.offerData.LocationHierarchy = locationHierarchy;
			this.oMessageManager.removeAllMessages();

			this.calcFinancials = true;
			this.removeFinancial = true;

			this.offerOperations.calculateFinancials(this.aFinHeaderFields).then(function (resultData) {
				var terms = null;
				var termsResult = null;

				var sError = that.getView().getModel("i18n").getResourceBundle().getText("CreateOffer.ErrorMessage.Calculate");
				checkForError(sError);

				if (!resultData) {
					return;
				}
				that.offerData.Margin = resultData.Margin;
				that.offerData.UnitProjection = resultData.UnitProjection;
				that.offerData.Sales = resultData.Sales;
				that.offerData.Profit = resultData.Profit;
				that.offerData.VendorFundImpact = resultData.VendorFundImpact;
				that.offerData.Currency = resultData.Currency;
				if ((that.offerData.Versions || []).length === (resultData.Versions || []).length) {
					that.offerData.Versions.forEach(function (currentVersion, index) {
						var version = resultData.Versions[index];
						currentVersion.Margin = version.Margin;
						currentVersion.UnitProjection = version.UnitProjection;
						currentVersion.Sales = version.Sales;
						currentVersion.Profit = version.Profit;
						currentVersion.VendorFundImpact = version.VendorFundImpact;
						currentVersion.Currency = version.Currency;
					});

				}
				if (resultData.Versions && payload.Versions && resultData.Versions && resultData.Versions.length !== payload.Versions.length) {
					throw new Error("Number of versions in the payload is no equal with the number of versions in the response");
				}
				if (resultData.Versions && resultData.Versions[index]) {
					var version = resultData.Versions[index];
					terms = resultData.Versions[index].Terms;
					if (!version || !terms) {
						return;
					}
					termsResult = terms;
					selectedVersion = payload.Versions[index];
					for (var i = 0; i < termsResult.length; i++) {
						if (selectedVersion.Terms[i]) {
							selectedVersion.Terms[i] = termsResult[i];
						}
					}
					selectedVersion.Margin = version.Margin;
					selectedVersion.UnitProjection = version.UnitProjection;
					selectedVersion.Sales = version.Sales;
					selectedVersion.Profit = version.Profit;
					selectedVersion.VendorFundImpact = version.VendorFundImpact;
					selectedVersion.Currency = version.Currency;
				} else {
					terms = resultData.Terms;
					if (!terms) {
						return;
					}
					termsResult = terms;
					for (var j = 0; j < termsResult.length; j++) {
						that.offerData.Terms[j] = termsResult[j];
					}
					selectedVersion = null;
				}
				that.addAllAfterCalculate(resultData);
				that.offerData.LocationHierarchy = locationHierarchy;
				that.offerData.Editable = true;
				that.setVersionData(that.offerData, that.staticData, null, selectedVersion, true);
			});
		},

		addAllAfterCalculate: function (resultData) {
			this.offerData.Versions.forEach(function (version) {
				this.updateTermForEveryVersion(version, resultData);
			}.bind(this));
			if (resultData.Terms && resultData.Terms.length > 0) {
				this.offerData.Terms = resultData.Terms;
			}
		},

		updateTermForEveryVersion: function (version, resultData) {
			var index = getVersionIndex(resultData.Versions, version);
			if (index !== -1) {
				var resultsTerms = resultData.Versions[index].Terms;
				if (resultsTerms && resultsTerms.length > 0) {
					version.Terms = resultsTerms;
				}
			}
		},

		onCollisionDetection: function () {
			var oView = this.getView();
			var sError = this.getView().getModel("i18n").getResourceBundle().getText("CreateOffer.ErrorMessage.Collision");

			this.calcFinancials = true;
			this.removeFinancial = true;

			this.contentModel.setProperty("/CollisionEnabled", false);
			Utils.getErrorHandler().showBusy();

			this.offerOperations.detectCollision().then(function (dialog) {
				this.offerOperations.populateCollisionDetection(dialog, this.state.getSavePayload(), oView).then(function () {
					Utils.getErrorHandler().hideBusy();
					checkForError(sError);
					this.contentModel.setProperty("/CollisionEnabled", true);
				}.bind(this));
			}.bind(this));
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

		onMessagesIndicatorPress: function (oEvent) {
			oMessagePopover.openBy(oEvent.getSource());
		},
		
		getOfferDataProvider: function () {
			return new OfferDataProvider(this);
		},
		promptMSDChange: function (channel, event, context) {
			var that = this;
			var system = context.MasterdataSystemId;
			var oldSystem = this.dataModel.getProperty("/MasterdataSystem");
			return Utils.promptUserForMasterDataSystemChange(system, oldSystem).then(function () {
				var data = that.state.getSavePayloadWithFinancials();
				data.Versions = [];
				data.Terms = [];
				that.state.store(data, {
					MasterdataSystem: system,
					LocationNodeId: "",
					ExtLocationNodeId: "",
					LeadingCategory: "",
					LeadingCategoryName: "",
					PromotionType: "",
					PurchasingGroup: ""
				});
				Models.setMasterDataSystemPersonalization(system);
				var mode = "edit";
				if (that.pathName === "versionCreate") {
					window.history.back();
					return;
				} else if (that.pathName === "versionDisplay") {
					mode = "display";
				}
				that.getRouter().navTo(mode, {
					path: Utils.base64ToHex(data.OfferId)
				}, true);

			});
		},

		onOfferContentSave: function () {
			var view = this.getView();
			Utils.offerContentSaveDialog(view).then(function () {
				var config = this.getOwnerComponent().getMetadata().getConfig();
				this.onSave().then(function (data) {
					if (data) {
						var sId = data.OfferId;
						Utils.toOfferContent(sId, config);
					}
				});
			}.bind(this), jQuery.noop);
		}
	});

});