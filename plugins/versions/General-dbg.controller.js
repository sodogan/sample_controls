/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/TreeValueHelpDialog",
		"retail/pmr/promotionaloffers/utils/DateHandler",
		"retail/pmr/promotionaloffers/utils/Formatter",
		"retail/pmr/promotionaloffers/plugins/versions/VersionsSelector",
		"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer",
		"retail/pmr/promotionaloffers/utils/Models"
	], function(Controller, JSONModel, Utils, TreeValueHelpDialog, DateHandler, FormatterHelper, VersionsSelector, ValueHelpDialogTokenizer, Models) {
	"use strict";
	
	function deleteUnneededFields(oData){
		var fields = ["PurchasingGroupName"];
		
		fields.forEach(function(field){
			delete oData[field];
		});
	}
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.versions.General", {
		
		constructor : function(){
			this.contentModel = new JSONModel();
			this.dataModel = new JSONModel();
			this.timeModel = new JSONModel();
			this.dateHandler = new DateHandler();
		},
		
		onInit: function() {
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);
			this.getView().setModel(this.timeModel, "Time");

			var resourceModel = Utils.getResourceModel();
			this.getView().setModel(resourceModel, "i18n");
			
			this.contentModel.setProperty("/Editable", true);
			this.oMessageManager = Utils.getMessageManager();
			this.i18nModel = Utils.getResourceModel();
			
			this.dateHandler.attachEvent("dateChanged", function(oEvent){
				// update model
				var source = oEvent.getSource();
				
				this.dataModel.setProperty("/StartOfOffer", source.getStartDate());
				this.dataModel.setProperty("/EndOfOffer", source.getEndDate());
				this.timeModel.setProperty("/StartTime", source.getStartTime());
				this.timeModel.setProperty("/EndTime", source.getEndTime());
				this.setWeekForStartOfOffer(source.getStartDate());
				this.setWeekForEndOfOffer(source.getEndDate());
				this.timeModel.refresh(true);
				
				//update tactics only when on main version
				if(!this.offerData.selectedVersion) {
					this.dateHandler.updateTactics(this.dataModel, this.timeModel);
				} 
				this.validateForm();
			}.bind(this));
		},
		
		/**
		 * Changes the date to 1 January 1970, but keeps the time.
		 *
		 * @param {object} oDate The date and time on which to reset the date.
		 * @returns {object} The date with the date reseted.
		 */
		getTime: function(oDate) {
			var oResult = new Date(0);
			oResult.setHours(oDate.getHours());
			oResult.setMinutes(oDate.getMinutes());
			oResult.setSeconds(oDate.getSeconds());
			return oResult;
		},
		
		getOfferData : function() {
			var oData = jQuery.extend({}, this.dataModel.getData());
			
			deleteUnneededFields(oData);
			
			var startOfOffer = oData.StartOfOffer;
			var endOfOffer = oData.EndOfOffer;

			oData.StartOfOffer = startOfOffer;
			oData.EndOfOffer = endOfOffer;
			oData.Tactics = (oData.Tactics || []).map(function(tactic){
			
				return {
					"OfferId" : tactic.OfferId || "",
					"TacticType" : tactic.TacticType,
					"TacticId" : tactic.TacticId,
					"StartOfTactic": DateHandler.getDate(tactic.StartOfTactic, tactic.StartTimeOfTactic),
					"EndOfTactic": DateHandler.getDate(tactic.EndOfTactic, tactic.EndTimeOfTactic),
					"TacticTypeDesc": tactic.TacticTypeDesc,
					"TacticDesc": tactic.TacticDesc
				};
			});
			return oData;
		},
		
		setOfferData : function(data, staticData, offer) {	
			offer.StartOfOffer = new Date(offer.StartOfOffer);
			offer.EndOfOffer = new Date(offer.EndOfOffer);
			this.offerData = offer;
			this.snapshotOffer = jQuery.extend(true, {}, this.offerData); 
			this.contentModel.setData(staticData);
			this.dataModel.setData(data);
			this.contentModel.setProperty("/Editable", !data.Readonly);
   			this.contentModel.setProperty("/TokenVisible", !offer.isTopLevel && !data.Readonly);
			
   			this.dataModel.setProperty("/LocationNodeId", data.LocationNodeId);
			this.contentModel.setProperty("/ExtNodeId",data.ExtNodeId);
			this.contentModel.setProperty("/ExtLocationNodeId", data.ExtLocationNodeId);
			var descriptionOrLocationNodeId = "";
			if(data.ExtNodeId) {
				descriptionOrLocationNodeId = jQuery.sap.formatMessage(data.ExtNodeId).trim();
			} else {
				descriptionOrLocationNodeId = data.ExtLocationNodeId;
			}
			
			this.manipulateHierarchy(this.offerData, descriptionOrLocationNodeId);
			
			var oStartTime = this.getTime(data.StartOfOffer);
			var oEndTime = this.getTime(data.EndOfOffer);
			this.timeModel.setData({
				Selected: Utils.isAllDay(data.StartOfOffer, data.EndOfOffer),
				StartTime: oStartTime,
				EndTime: oEndTime,
				PreviousStartOfOffer: data.StartOfOffer,
				PreviousEndOfOffer: data.EndOfOffer,
				PreviousStartTime: oStartTime,
				PreviousEndTime: oEndTime,
				ValidStartOfOffer: data.StartOfOffer ? true : false,
				ValidEndOfOffer: data.EndOfOffer ? true : false
			});
			this.dateHandler.setStartDate(data.StartOfOffer);
			this.dateHandler.setEndDate(data.EndOfOffer);
			this.dateHandler.setStartTime(oStartTime);
			this.dateHandler.setEndTime(oEndTime);
			this.dateHandler.setPrevStartDate( data.StartOfOffer);
			this.dateHandler.setPrevEndDate(data.EndOfOffer);
			this.dateHandler.setPrevStartTime(oStartTime);
			this.dateHandler.setPrevEndTime(oEndTime);
			this.setWeekForStartOfOffer(data.StartOfOffer);
			this.setWeekForEndOfOffer(data.EndOfOffer);
			
			if (data.Tactics && data.Tactics.length) {
				data.Tactics.forEach(function(oTactic) {
					oTactic.StartTimeOfTactic = this.getTime(oTactic.StartOfTactic);
					oTactic.EndTimeOfTactic = this.getTime(oTactic.EndOfTactic);
				}.bind(this));
			}
			if (data && data.MasterdataSystem) {
				this.setMasterDataSystemDependentCombos(data.MasterdataSystem);
			}
			
			
		},
		
		/**
		* Sets Leading Category, based on master data system selection.
		*
		* @param {string} sMasterDataSystem The master data system id.
		* @returns {object} The promise with the response
		*/
		setLeadingCategory: function(sMasterDataSystem) {
	   		var editable = this.contentModel.getProperty("/Editable");
			if(!editable) {
				return;
			}
			this.contentModel.setProperty("/LeadingCategoryBusy", true);
			// read leading category
			return Models.getLeadingCategoriesSet(sMasterDataSystem).then(function(aLeadingCategoriesSet) {
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
		setMasterDataSystemDependentCombos: function(sMasterDataSystem) {
			this.contentModel.setProperty("/PromotionTypeEnabled", false);
			this.contentModel.setProperty("/PurchasingGroupEnabled", false);
			this.contentModel.setProperty("/LeadingCategoriesSet", []);
			
			return Models.getPromotionTypeSetAndPurchasingGroupSet(sMasterDataSystem).then(function(results){
				var promotionTypeSet = results[0];
				var purchasingGroupSet = results[1];

				this.contentModel.setProperty("/PromotionTypeSet", promotionTypeSet);
				this.contentModel.setProperty("/PromotionTypeEnabled", true);
				
				this.contentModel.setProperty("/PurchasingGroupSet", purchasingGroupSet);
				this.contentModel.setProperty("/PurchasingGroupEnabled", true);
				
			}.bind(this));

		},
		
		uncheckAllHierarhy: function(locHierarchy) {
			var resetHierarchy = function(hierarchy){
				if (!hierarchy) {
					return;
				}
				hierarchy.checked = false;
				
				for(var i in hierarchy){
					if(hierarchy.hasOwnProperty(i) && jQuery.isNumeric(i)){
						resetHierarchy(hierarchy[i]);
					}
				}		
			};
			resetHierarchy(locHierarchy);
		},
		
		manipulateHierarchy: function(offerData, description) {
			var offer = this.offerData;
			this.expandAll = [];
			var descriptionOrLocationNodeId = this.contentModel.getProperty("/LocationText");
			if (offerData) {
				offer = offerData;
			}
			this.uncheckAllHierarhy(offer.hierarchy);
			if (description) {
				descriptionOrLocationNodeId = description;
			}
			this.descriptionToUse = descriptionOrLocationNodeId;
			var locationControl = this.getView().byId("generalLocation");
			var tokens = [];
			var locationArray = [];
			this.selectedLocations = [];
			this.currentParent = null;
			if(this.isLocalNodeForThisVersion(offer, descriptionOrLocationNodeId)) {
				var object = this.getUserCreatedNodeChildrens(offer.hierarchy, descriptionOrLocationNodeId);
				locationArray = object.locationArray;
				this.selectedLocations = object.selectedLocations;
			} else {
				this.selectedLocations = this.getSelectedLocations(offer.hierarchy);
			}
			var name = this.dataModel.getProperty("/Name");
			var LocationNodeId = this.dataModel.getProperty("/LocationNodeId");
			if (locationArray && locationArray.length > 0) {
				var nameArray = [];
				locationArray.forEach(function(location) {
					nameArray.push(location.text);
					tokens.push(new sap.m.Token(location));
				});
				if (description) {
					locationControl.setTokens(tokens);
				}
				var finalName = name ? name : nameArray.join(";");
				var trimName = false;
				if (finalName.length > 40) {
					finalName = finalName.substring(0, 37) + "...";
					trimName = true;
				}
				this.dataModel.setProperty("/Name", finalName);
				if (trimName) {
					this.getEventBus().publish("retail.pmr.promotionaloffers", "changeLocationNameInSideTable", {versionName: this.dataModel.getProperty("/Name")});
					trimName = false;
				}
				this.contentModel.setProperty("/DefaultName", nameArray.join(";"));
				this.contentModel.setProperty("/LocationText", nameArray.join(";"));
			} else {
				if (description) {
					var toDisplay = descriptionOrLocationNodeId;
					if (this.selectedLocations[0].Name) {
						toDisplay = this.selectedLocations[0].Name + " (" + toDisplay + ")";
					}
					tokens.push(new sap.m.Token({text: toDisplay, key: LocationNodeId}));
					locationControl.setTokens(tokens);
					this.contentModel.setProperty("/DefaultName", toDisplay);
				}	
				this.dataModel.setProperty("/Name",  name ? name : descriptionOrLocationNodeId);
				this.contentModel.setProperty("/LocationText", descriptionOrLocationNodeId);
			}
		},
		
		isLocalNodeForThisVersion: function(offer, descriptionOrLocationNodeId) {
			var islocalNode = false;
			if(offer.LocalNodes && offer.LocalNodes.length > 0) {
				offer.LocalNodes.forEach(function(item) {
					if (item.Description === descriptionOrLocationNodeId) {
						islocalNode = true;
					}
				});
			}	
			return islocalNode;
		},
		
		getUserCreatedNodeChildrens: function(hierarchy, description) {
			var locationArray = [];
			var selectedLocations = [];
			var originalHierarchy = hierarchy;
			var parentOfUserNode = null;
			var that = this;
			var key = null;
			
			var getUserNode = function(hierarchy, description) {
				if (hierarchy && hierarchy.ExtNodeId === description) {
					hierarchy.expanding = true;
					hierarchy.checked = true;
					hierarchy.isParent = true;
					for (key in hierarchy) {
						if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
							if (!hierarchy[key].excluded) {
								hierarchy[key].checked = true;
							}	
							hierarchy[key].isChild = true;
							hierarchy[key].expanding = true;
							selectedLocations.push(hierarchy[key]);
						}
					}	
					if (parentOfUserNode) {
						that.expandAllParents(parentOfUserNode.ParentId, originalHierarchy, parentOfUserNode);
					}	
					if (that.expandAll.indexOf(hierarchy) === -1) {
						that.expandAll.push(hierarchy);
					}	
					
					var locationNames = hierarchy.NodeName.split(";");
					var locationIds = hierarchy.LocationIds.split(";");
					if (locationNames.length ===  locationIds.length) {
						for (var i = 0; i < locationNames.length; i++) {
							locationArray.push({text: locationNames[i], key: locationIds[i]});
						}
					}
				}
				if (!locationArray || (locationArray && locationArray.length < 1)) {
					for (key in hierarchy) {
						if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
							if (hierarchy[key].ExtNodeId === description) {
								parentOfUserNode = hierarchy; 
								that.currentParent = hierarchy;
								
							}
							getUserNode(hierarchy[key], description);		
						}
					}
				}
				
			};
			getUserNode(hierarchy, description);
			return {
				locationArray: locationArray,
				selectedLocations: selectedLocations
			};
		},
		
		getSelectedLocations: function(hierarchy) {
			var locationNodeSelected = this.dataModel.getProperty("/LocationNodeId");
			var selectedLocations = [];
			var originalHierarchy = hierarchy;
			var that = this;
			var getSelectedItems = function(hierarchy, locationNodeSelected) {
				var locationNode = hierarchy.NodeId || hierarchy.LocationId;
				if ( locationNodeSelected === locationNode) {
					selectedLocations.push(hierarchy);
					hierarchy.checked = true;
					hierarchy.expanding = true;
					if (that.expandAll.indexOf(hierarchy) === -1) {
						that.expandAll.push(hierarchy);
					}
					that.expandAllParents(hierarchy.ParentId, originalHierarchy);
				}
				if (!selectedLocations || (selectedLocations && selectedLocations.length < 1)) {
					for (var key in hierarchy) {
						if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
							getSelectedItems(hierarchy[key], locationNodeSelected);		
						}
					}
				}
			};
			getSelectedItems(hierarchy, locationNodeSelected);
			this.expandAll = this.expandAll.reverse();
			return selectedLocations;
			
		},
		
		expandAllParents: function(ParentId, originalHierarchy, parentHierarchy) {
			var that = this;
			var newHierarchy = originalHierarchy;
			var expandParents = function(ParentId, hierarchy) {
				var currentParentId = ParentId;
				if (!Utils.isInitial(currentParentId)) {
					for (var key in hierarchy) {
						if(hierarchy.hasOwnProperty(key) && jQuery.isNumeric(key)){
							var nodeId = hierarchy.NodeId || hierarchy.ExtNodeId;
							newHierarchy = hierarchy[key];
							if (currentParentId === nodeId) {
								hierarchy.expanding = true;
								if (that.expandAll.indexOf(hierarchy) === -1) {
									that.expandAll.push(hierarchy);
								}	
								currentParentId = hierarchy.ParentId;
								newHierarchy = originalHierarchy;
							}
							
							expandParents(currentParentId, newHierarchy);		
						}
					}
				}
			};
			expandParents(ParentId, originalHierarchy);
			if (parentHierarchy) {
				parentHierarchy.expanding = true;
				if (that.expandAll.indexOf(parentHierarchy) === -1) {
					that.expandAll.push(parentHierarchy);
				}
				this.selectedLocations.forEach(function(item) {
					if (that.expandAll.indexOf(item) === -1) {
						that.expandAll.push(item);
					}
				});
			}
			var originalHierarchyIndex = this.expandAll.indexOf(originalHierarchy);
			if (this.expandAll.indexOf(originalHierarchy) !== -1) {
				this.expandAll.splice(originalHierarchyIndex, 1);
			}
			
		},
		
		timePickerVisible: function(selected) {
	   		return !selected ?  "L6 M6 S6" : "L12 M12 S12";
	   	},
	   	
		onAllDaySelect: function(oEvent){
	   		var selected = oEvent.getParameter("selected");
	   		
	   		if(selected) {
	   			this.dateHandler.onAllDaySelect();
	   		}
	   		this.timeModel.setProperty("/Selected", selected);
			this.timeModel.refresh(true);
	   	},
	   	
	   	/**
		 * Sets the week for start of offer to the summary.
		 *
		 * @param {object} oStartOfOffer The start of offer. If null, it will not search for the week and it will clear the (previous) week.
		 * @returns {void}
		 */
		setWeekForStartOfOffer: function(oStartOfOffer) {
			if (!oStartOfOffer) {
				this.timeModel.setProperty("/StartWeek", "");
				return;
			}
			Utils.getWeek(oStartOfOffer).then(function(sWeek) {
				this.timeModel.setProperty("/StartWeek", sWeek.trim());
			}.bind(this), function() {
				this.timeModel.setProperty("/StartWeek", "");
			}.bind(this));
		},

		/**
		 * Sets the week for end of offer to the summary.
		 *
		 * @param {object} oEndOfOffer The end of offer. If null, it will not search for the week and it will clear the (previous) week.
		 * @returns {void}
		 */
		setWeekForEndOfOffer: function(oEndOfOffer) {
			if (!oEndOfOffer) {
				this.timeModel.setProperty("/EndWeek", "");
				return;
			}
			Utils.getWeek(oEndOfOffer).then(function(sWeek) {
				this.timeModel.setProperty("/EndWeek", sWeek.trim());
			}.bind(this), function() {
				this.timeModel.setProperty("/EndWeek", "");
			}.bind(this));
		},
		
		markErrors: function() {
			var aItems = this.getErrorItems();
			var aErrorMessages = this.buildErrors(aItems);
			for (var i = 0; i < aItems.length; i++) {
				Utils.removeMessagesByPath(aItems[i].Target);				
			}
			Utils.setErrorMessages(this.oMessageManager, aErrorMessages);			
			return aErrorMessages.length;
		},
		
		openLeadingCategoryDialog: function() {
			TreeValueHelpDialog.openDialog({
				tableFragment: "retail.pmr.promotionaloffers.plugins.general.LeadingCategoryComplexSearch",
				title : "{i18n>CreateOffer.General.LeadingCategory}",
				filterProps : ["ExtId","Name","HierarchyDescription","ExtHierarchyId"],
				values : Utils.buildHierarchy(this.contentModel.getData().LeadingCategoriesSet, "LeadingCategory")
			}).then(function(selection){
				if(!selection){
					this.dataModel.setProperty("/LeadingCategory", null);
					this.dataModel.setProperty("/LeadingCategoryName", "");
					return;
				}
				this.dataModel.setProperty("/LeadingCategory", selection.Id);
				this.dataModel.setProperty("/LeadingCategoryName", jQuery.sap.formatMessage(selection.ExtId, " ", selection.Name));
				this.validateLeadingCategory();
			}.bind(this));
		},

		handleLeagingCategoryComplexSearch: function(){
			var leadingCategories = this.contentModel.getProperty("/LeadingCategoriesSet") || [];
			if(!leadingCategories.length) {
				var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
				this.setLeadingCategory(masterdataSystem).then(function(){
					this.openLeadingCategoryDialog();
				}.bind(this));
				return;
			}
			this.openLeadingCategoryDialog();
		},

		/**
		 * Fired when a suggestion item is selected for the leading category input.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onLeadingCategorySuggestionSelect: function(oEvent) {
			var oSelectedItem = oEvent.getParameters("selectedItem").selectedItem;
			var sId = oSelectedItem.getProperty("key");
			var sText = oSelectedItem.getProperty("text");
			this.dataModel.setProperty("/LeadingCategory", sId);
			this.dataModel.setProperty("/LeadingCategoryName", sText);
			this.validateLeadingCategory();
		},
		
		onLeadingCategorySuggest: function(oEvent) {
			var leadingCategories = this.contentModel.getProperty("/LeadingCategoriesSet") || [];
			if(leadingCategories.length || this.contentModel.getProperty("/LeadingCategoryBusy")) {
				return;
			}
			var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
			this.setLeadingCategory(masterdataSystem).then(function(){
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
		leadingCategoryValueChanged: function(oEvent) {
			var sValue = oEvent.getSource().getValue();
			this.dataModel.setProperty("/LeadingCategory", "");

			if (!sValue) {
				this.validateLeadingCategory();
				return;
			}
			
			function updateLC(){
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
			
			if(!(this.contentModel.getProperty("/LeadingCategoriesSet") || []).length) {
				var masterdataSystem = this.dataModel.getProperty("/MasterdataSystem");
				this.setLeadingCategory(masterdataSystem).then(function(){
					updateLC.call(this);
				}.bind(this));
				return;
			}
			updateLC.call(this);
		},
		
		validateLeadingCategory: function (){
			var value = this.dataModel.getProperty("/LeadingCategoryName");
			var message = {
				message: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLeadingCategory.Invalid.Title"),
				description: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralLeadingCategory.Invalid.Description")
			};
			return this.validateByPath("/LeadingCategoryName", this.dataModel, message, function(){
				return (!value || this.dataModel.getProperty("/LeadingCategory"));
			}.bind(this));
		},
		
		validateByPath: function(path, model, message, fNoErrors) {
			Utils.removeMessagesByPath(path);
			if(fNoErrors()) {
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
		
		setLocationDataFromSnapshot: function() {
			this.offerData.hierarchy = this.snapshotOffer.hierarchy;
		},
		
		validSelectionExist: function(selected) {
			var selectedObj = jQuery.extend(true, [], selected);
			var filterSelected = selectedObj.filter(function(item) {return !item.excluded; });
			if (filterSelected && filterSelected.length > 0) {
				return true;
			}
			return false;
		},
		
		/**
		 * Fired when location input help button is pressed.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		handleLocationComplexSearch: function() {
			var that = this;
			var table = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.versions.VersionsTree", this);	
			var offer = jQuery.extend(true, {}, this.offerData);
			this.manipulateHierarchy(offer, this.descriptionToUse);
			var selector = new VersionsSelector(table,offer.hierarchy,this.i18nModel,offer.Versions,offer.ExcludedNodes,this.selectedLocations);
			var params = { rowContext : this.expandAll[0], expanded : true, isObject : true};
			selector.asyncExpand(params);
					
			table.attachToggleOpenState(function(e){
				var oParams = { 
					rowContext : e.getParameter("rowContext"), 
					expanded : e.getParameter("expanded")
				};
				selector.asyncExpand(oParams);
			});
			
			var settingValueHelpDialog = {
					title: this.i18nModel.getResourceBundle().getText("Versions.Location.ValueHelpDialog"),
					supportMultiselect: true,
					stretch: sap.ui.Device.system.phone,
					ok: function() {
						var selectedLocations = selector.getSelected();
						var parent = null;
						if(selectedLocations && selectedLocations.length > 0){
							parent = selector.getParentItem(selectedLocations[0]);
						}
						var dataLocations = {
								parent: parent,
								selectedLocations: selectedLocations
						};
						if (that.validSelectionExist(selectedLocations)) {
							that.getEventBus().publish("retail.pmr.promotionaloffers", "onVersionLocationChange", dataLocations);
							this.close();
							if (that._versionsDialog) {
								that._versionsDialog.destroy();
							}
						} else {
							that.alertNoLocationSelected();
						}
						
					},
					cancel: function() {
						this.close();	
						that._versionsDialog.destroy();
					},
					selectionChange : function(e){
						selector.selectionChanged(e);
					}	
			};		
			this._versionsDialog = new ValueHelpDialogTokenizer("versionsLocationPickerID",settingValueHelpDialog);
			this._versionsDialog.addStyleClass("sapUiSizeCompact");
			this._versionsDialog.setTable(table);
			table.getModel().setSizeLimit(Utils.getSizeLimit());
			table.setVisibleRowCount(selector.data.length);
			selector.setVHDialog(this._versionsDialog,{StartOfOffer: this.dataModel.getData().StartOfOffer, EndOfOffer: this.dataModel.getData().EndOfOffer});
			this._versionsDialog.open();
		},
		
		alertNoLocationSelected: function() {
			var sMsg = this.i18nModel.getResourceBundle().getText("Versions.NoSelectedLocationMessage");
			Utils.getErrorHandler().showError(sMsg);
		},
		
		getEventBus : function(){
   			return sap.ui.getCore().getEventBus();
   		},
		
   		onLocationChange: function(oControlEvent){	
   			if (oControlEvent.getParameters().type === "removed") {
   				var selected = jQuery.extend(true, [], this.selectedLocations);
   				var token = oControlEvent.getParameters().token;
   				
	   				for (var i = 0; i < selected.length; i++) {
	   					var locationId = selected[i].LocationId || selected[i].NodeId;
	   					var tokenKey = token.getKey();
	   					if (locationId === tokenKey) {
	   						selected.splice(i,1);
	   					}
	   				}
	   			if (this.validSelectionExist(selected)) {
	   				var dataLocations = {
							parent: this.currentParent,
							selectedLocations: selected
					};
	   				this.selectedLocations = selected;
					this.getEventBus().publish("retail.pmr.promotionaloffers", "onVersionLocationChange", dataLocations);
   				} else {
   					var locationControl = this.getView().byId("generalLocation");
   					var tokens = locationControl.getTokens() || [];
   					tokens.push(new sap.m.Token({text: token.getText(), key: token.getKey()}));
   					locationControl.setTokens(tokens);
   					this.alertNoLocationSelected();
   				}	
   			}
   			
		},
		
		onNameChanged: function() {
			var defaultName = this.contentModel.getProperty("/DefaultName");
			if (!this.dataModel.getProperty("/Name")) {
				if (defaultName.length > 40) {
					defaultName = defaultName.substring(0, 37) + "...";
				}
				this.dataModel.setProperty("/Name", defaultName);
			}	
			this.validateForm();
			this.getEventBus().publish("retail.pmr.promotionaloffers", "changeLocationNameInSideTable", {versionName: this.dataModel.getProperty("/Name")});
			
		},
		
		validateForm: function() {
			var validate = this.markErrors();
			return validate;
		},
		
		getErrorItems: function() {
			var aItems = [{
				Property: "/StartOfOffer",
				Target: "/StartOfOffer",
				Mandatory: true,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Description"),
				ErrorTitleInvalidValue: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Invalid.Title"),
				ErrorDescriptionInvalidValue: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Description"),
				ErrorDescriptionInvalidDate: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartDate.Description")
			}, {
				Property: "/EndOfOffer",
				Target: "/EndOfOffer",
				Mandatory: true,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Description"),
				ErrorTitleInvalidValue: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Invalid.Title"),
				ErrorDescriptionInvalidValue: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Description"),
				ErrorDescriptionInvalidDate: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndDate.Description")
			}, {
				Property: "/StartTime",
				Target: "/StartTime",
				Mandatory: true,
				Model: this.timeModel,
				TargetModel: this.timeModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartTime.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralStartTime.Description")
			}, {
				Property: "/EndTime",
				Target: "/EndTime",
				Mandatory: true,
				Model: this.timeModel,
				TargetModel: this.timeModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndTime.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralEndTime.Description")
			}, {
				Property: "/Name",
				Target: "/Name",
				Mandatory: true,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.Description"),
				ErrorTitleTooLong: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.TitleTooLong"),
				ErrorDescriptionTooLong: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.DescriptionTooLong")
			}, {
				Property: "/Description",
				Target: "/Description",
				Mandatory: false,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferDescription.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferDescription.Description")
			},{
				Property: "/Tactics",
				Target: "/Tactics",
				Mandatory: false,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferTactics.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferTactics.Description")
			}];

			return aItems;
		}, 
		
		buildErrors: function(arry) {
			var validateItem = function(oItem, value) {
				var oErrorInfo = null;
				var offerData = this.offerData;
				
				var startDate = offerData.StartOfOffer;
				var endDate = offerData.EndOfOffer;
				var start = this.dataModel.getProperty("/StartOfOffer");
				var end = this.dataModel.getProperty("/EndOfOffer");
				var selectedVersion = this.offerData.selectedVersion;
				switch (oItem.Property) {
					case "/Name":
						if (value.length > 40) {
							oErrorInfo = {
									Title: oItem.ErrorTitleTooLong,
									Description: oItem.ErrorDescriptionTooLong
							};
						}
						break;
						
					case "/Tactics" : 
						if (!value) {
							break;
						}
						var errors = value.filter(function(tactic) {
							return start > tactic.StartOfTactic || end < tactic.EndOfTactic;
						});
						if(errors.length && !selectedVersion) {
							oErrorInfo = {
									Title: oItem.ErrorTitle,
									Description: oItem.ErrorDescription
							};
						}
						break;
						
					case "/Description":
						if (value && value.length > 255) {
							oErrorInfo = {
									Title: oItem.ErrorTitle,
									Description: oItem.ErrorDescription
							};
						}
						break;
					case "/StartOfOffer":
						if (!this.timeModel.getProperty("/ValidStartOfOffer")) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description: oItem.ErrorDescriptionInvalidValue
							};
						} else if (!this.validOfferDate("StartOfOffer")) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description: oItem.ErrorDescriptionInvalidDate
							};
						} else if(!this.offerData.isTopLevel && startDate.getTime() > this.dataModel.getProperty("/StartOfOffer").getTime()) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description:this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralDateInterval.Description")
							};
						}
						break;
					case "/EndOfOffer":
						if (!this.timeModel.getProperty("/ValidEndOfOffer")) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description: oItem.ErrorDescriptionInvalidValue
							};
						} else if (!this.validOfferDate("EndOfOffer")) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description: oItem.ErrorDescriptionInvalidDate
							};
						} else if(!this.offerData.isTopLevel && endDate.getTime() < this.dataModel.getProperty("/EndOfOffer").getTime()) {
							oErrorInfo = {
									Title: oItem.ErrorTitleInvalidValue,
									Description:this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralDateInterval.Description")
							};
						}
						break;
				}
				return oErrorInfo;
			}.bind(this);

			var aErrorMessages = [];
			arry.forEach(function(oItem) {
				var value = oItem.Model.getProperty(oItem.Property);
				var bMandatoryField = oItem.Mandatory; 
				var oErrorInfo = null;

				if (bMandatoryField && !value) {
					oErrorInfo = {
							Title: oItem.ErrorTitle,
							Description: oItem.ErrorDescription
					};
				} else {
					oErrorInfo = validateItem(oItem, value);
				}

				if (oErrorInfo) {
					aErrorMessages.push({
						message: oErrorInfo.Title,
						description: oErrorInfo.Description,
						target: oItem.Target,
						type: "Error",
						processor: oItem.TargetModel
					});
				}
			});

			return aErrorMessages;
		},
		
		/**
		 * Checks if offer date is valid.
		 *
		 * @param {string} sType The date type: StartOfOffer or EndOfOffer.
		 * @returns {boolean} True if the date is valid, false otherwise.
		 */
		validOfferDate: function(sType) {
			var bValid = true;
			var oStartOfOffer = this.dataModel.getProperty("/StartOfOffer");
			var oEndOfOffer = this.dataModel.getProperty("/EndOfOffer");
			switch (sType) {
				case "StartOfOffer":
					if (!oStartOfOffer) {
						bValid = false;
					} else if (oEndOfOffer && oStartOfOffer.getTime() >= oEndOfOffer.getTime()) {
						bValid = false;
					}
					break;
				case "EndOfOffer":
					if (!oEndOfOffer) {
						bValid = false;
					} else if (oStartOfOffer && oStartOfOffer.getTime() >= oEndOfOffer.getTime()) {
						bValid = false;
					}
					break;
			}
			return bValid;
		},
		
		/**
		 * Triggered when changing the start date of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferStartDateChange: function(oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if(!valid) {
				this.dataModel.setProperty("/StartOfOffer", new Date(NaN));
				this.dataModel.setProperty("/StartOfOffer", date);
			}
			this.dateHandler.startDateChanged(date, valid);
			this.getEventBus().publish("retail.pmr.promotionaloffers", "validateVersions", {});
		},

		/**
		 * Triggered when changing the end date of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferEndDateChange: function(oEvent) {
			var valid = oEvent.getParameter("valid");
			var date = oEvent.getSource().getDateValue();
			if(!valid) {
				this.dataModel.setProperty("/EndOfOffer", new Date(NaN));
				this.dataModel.setProperty("/EndOfOffer", date);
			}
			this.dateHandler.endDateChanged(date, valid);
			this.dateHandler.endDateChanged(oEvent.getSource().getDateValue(), oEvent.getParameter("valid"));
			this.getEventBus().publish("retail.pmr.promotionaloffers", "validateVersions", {});
		},

		/**
		 * Triggered when changing the start time of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		onOfferStartTimeChange: function(oEvent) {
			this.dateHandler.startTimeChanged(new Date(oEvent.getSource().getDateValue()));
			this.getEventBus().publish("retail.pmr.promotionaloffers", "validateVersions", {});
   		},
		
		/**
		 * Triggered when changing the end time of offer.
		 *
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
   		onOfferEndTimeChange: function(oEvent) {
			this.dateHandler.endTimeChanged(oEvent.getSource().getDateValue());
			this.getEventBus().publish("retail.pmr.promotionaloffers", "validateVersions", {});
		},
		
		
		timeLabelValueFormatter : function(time){
			return this.dateHandler.getFormatTimePiker(time);
		},
		
		/**
		 * Changes the end date based on the start date.
		 * The old difference between start and end date is applied.
		 * 
		 * @param {object} oStartOfOffer The start of offer, as date.
		 * @returns {void}
		 */
		adaptEndDate: function(oStartOfOffer) {
			var oEndOfOffer = this.dataModel.getProperty("/EndOfOffer");
			if (!oEndOfOffer) {
				return;
			}
			var oPreviousStartOfOffer = this.timeModel.getProperty("/PreviousStartOfOffer");
			var iDifference = oEndOfOffer.getTime() - oPreviousStartOfOffer.getTime();
			var oNewEndOfOffer = new Date(oStartOfOffer.getTime() + iDifference);
			this.dataModel.setProperty("/EndOfOffer", oNewEndOfOffer);
			this.timeModel.setProperty("/PreviousEndOfOffer", oNewEndOfOffer);
		},
		
		/**
		 * Sets offer date with the new time based on the given path.
		 *
		 * @param {string} sPath The date path to be updated.
		 * @param {object} oTime The time to be set on the date.
		 * @returns {object} The date with the updated time.
		 */
		setOfferDate: function(sPath, oTime) {
			var oDate = this.dataModel.getProperty(sPath);
			var oDateResult = this.dateHandler.getDate(oDate, oTime);
			this.dataModel.setProperty(sPath, oDateResult);
			return oDateResult;
		}
	
	});
});