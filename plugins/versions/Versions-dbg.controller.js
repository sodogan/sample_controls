/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise */
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/plugins/versions/VersionsSelector",
		"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer",
		"retail/pmr/promotionaloffers/plugins/versions/VersionsHelper"
	], function(Controller,JSONModel,Utils,VersionsSelector,ValueHelpDialogTokenizer,VersionsHelper) {
	"use strict";
	
	function getVersionIndex(versions, versionObject) {
   		if (versions && versionObject) {	
			for (var i = 0; i < versions.length; i++) {
				var versionLocation = versions[i].LocationNodeId || versions[i].LocationId || versions[i].ExtLocationNodeId;
				var versionObjectLocation = versionObject.LocationNodeId || versionObject.LocationId || versionObject.ExtLocationNodeId;
	   	        if (versionLocation === versionObjectLocation) {
	   	            return i;
	   	        }
	   	    }
		}   
   	    return -1;
   	}
	
	function createVersionsManagePage(offerData, staticData, loader, selectedVersion, router){
		var result;
		var versionId = selectedVersion && selectedVersion.OfferId ? selectedVersion.OfferId : null;
		var offerId = offerData.OfferId && offerData.OfferId != null ? offerData.OfferId : null;
		var versionIdToDisplay = versionId ? versionId : offerId;
		var versionMode = "versionDisplay";
		if (versionIdToDisplay && versionId) {		
			if (!offerData.Readonly) {
				versionMode = "versionEdit";
			}
			result = router.navTo(versionMode, {
				path : Utils.base64ToHex(offerData.OfferId),
				id : Utils.base64ToHex(versionIdToDisplay)
			});
		} else if(offerId) {
			if (!offerData.Readonly) {
				versionMode = "versionEdit";
			}
			result = router.navTo(versionMode, {
				path : Utils.base64ToHex(offerData.OfferId),
				id : Utils.base64ToHex(offerId)
			});
		}
		else {
			versionMode = "versionCreate";
			result = router.navTo(versionMode);
		}		
		var view = result.getView("retail.pmr.promotionaloffers.view.VersionTabs", "XML");
		var controller = view.getController();
		controller.resetLocationSelected();
		controller.setVersionData(jQuery.extend(true, {}, offerData), staticData, null, selectedVersion, true);

	}


	function createLocalNodes(parent,items){
		var children = [];
		var toReturn = null;
		if(items.length >= 2){
			for(var i = 0, iLen = items.length; i < iLen; i++){
				children.push(Utils.getNodeType(items[i],"NodeId","NodeType"));
			}
			
			var parentID = parent.NodeId || parent.LocationId;
			toReturn = {"ParentId" : parentID, "Description" : Utils.guid(), "Children" : children, "HierarchyId" : parent.HierarchyId}; 
		}else{
			var locationNodeId = items[0].NodeId || items[0].LocationId;
			toReturn = {"LocationNodeId" : locationNodeId, "HierarchyId" : parent.HierarchyId};
		}
				
		return toReturn;
	}
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.versions.Versions", {
		constructor : function(){
   			Controller.apply(this, arguments);
   			this.dataProvider = null;
   			this.oModel = new JSONModel();
   			this.contentModel = new JSONModel();
   		},   		
		onInit: function() {
			this.getView().setModel(this.oModel);
			this.i18nBundle = Utils.getResourceModel();
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "launchVersionPage", this.versionPage, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "setLocationSelection", this.setLocationSelection, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "setLocationData", this.setLocationData, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "deleteInvalidVersions", this.deleteInvalidVersions, this);
			this.getEventBus().subscribe("retail.pmr.promotionaloffers", "updateVersions", this.updateVersions, this);
			this.state = this.getOwnerComponent().getState();
		},
		onExit: function(){
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "launchVersionPage", this.versionPage, this);
			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "setLocationSelection", this.setLocationSelection, this);
   			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "setLocationData", this.setLocationData, this);
   			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "deleteInvalidVersions", this.deleteInvalidVersions, this);
   			this.getEventBus().unsubscribe("retail.pmr.promotionaloffers", "updateVersions", this.updateVersions, this);
		},
		getEventBus : function(){
   			return sap.ui.getCore().getEventBus();
   		},  		
   		deleteInvalidVersions: function(channel, event, context){
   			this.refreshVersions(context.versions);
   			this.oModel.setProperty("/LocalNodes", context.localNodes); 
   			
   		},  		
   		updateVersions: function(channel, event, context){
   			this.oModel.setProperty("/VersionItems", context.versions); 
   			this.contentModel.setProperty("/VersionItems", context.versions);
   			
   		},  		
   		refreshVersions: function(versions) {
   			this.oModel.setProperty("/VersionItems", versions); 
   			this.contentModel.setProperty("/VersionItems", versions);
   			
   			var oSmartTable = this.getView().byId("versions");
   			oSmartTable.rebindTable();
   		},
   		
		setLocationSelection: function(channel, event, context){
			if (!context.isOnlyExclude) {
				this.resetData();
				this.oModel.setProperty("/LocalNodes", []); 
				this.refreshVersions([]);
				this.ChangedHierarchy = true;
				this.contentModel.setProperty("/ParentNode",context.includeNode);
				this.contentModel.setProperty("/ExcludedNodes",context.excludedNodes);
				this.contentModel.setProperty("/Hierarchy",context.hierarchy);
			}			
			
			
		},
		setLocationData: function(channel, event, context){
			this.contentModel.setProperty("/LocationSet",context.locationSet);
		},
		onAfterRendering: function() {
   			this.getView().byId("versions")._addHeaderToToolbar();   			
   		},
		getOfferData: function(data){
			var versions = this.oModel.getProperty("/VersionItems") || [];
			versions.forEach(function(version) {		
				if (version.LocationId) {
					version.LocationNodeId = version.LocationId;
				}
				delete version.LocationId;	
				delete version.Readonly;
				delete version.isShowingParent;
			});
			return {
				Versions : versions,
				LocalNodes : this.oModel.getProperty("/LocalNodes") || []
			};
		},		
		setOfferData : function(data){
			var versionsFromData = data.Versions || [];
			versionsFromData.forEach(function(version) {		
				delete version.locationPath;	
			});
			if (data.LocationHierarchy && data.LocationHierarchy.length > 0) {
				this.locationHierarchy = data.LocationHierarchy;
			}		
			data.LocationHierarchy = this.locationHierarchy;
			this.oModel.setProperty("/Editable", !data.Readonly);
			this.oModel.setProperty("/LocalNodes", data.LocalNodes);		
   			if (!this.ChangedHierarchy) {
   				var versionsHelper = new VersionsHelper(data);				
   				var versions = versionsHelper.getAvailableVersions();
   	   			this.oModel.setProperty("/VersionItems", versions); 
   	   			versions.forEach(function(version){
   	   				version.UnitProjection = parseFloat(version.UnitProjection) + "";
   	   			});
   	   			this.contentModel.setProperty("/VersionItems", versions);
   	   			
   	   			this.contentModel.setProperty("/Hierarchy",versionsHelper.getHierarchy()[0]); 
   			}	
   			var oSmartTable = this.getView().byId("versions");
   			if (oSmartTable) {
   				oSmartTable.rebindTable();
   			}
   			
   		},  
   		setDataProvider: function(loader){
			this.dataProvider = loader;
		},
		onSelectionChange: function(oEvent){
			var aSelectedContexts = oEvent.getSource().getSelectedContexts();
   			var iSelectedRows = aSelectedContexts.length;
   			this.contentModel.setProperty("/DeleteEnabled", !!iSelectedRows);
		},
		getRouter : function () {
   			return sap.ui.core.UIComponent.getRouterFor(this);
   		},
		
		/**
	   	 * Performs table refresh.
	   	 *
		 * @returns {void}
	   	 */
	   	refreshOffersTable: function() {
	   		this.versions.removeSelections();
	   		this.contentModel.setProperty("/DeleteEnabled", false);
	   	},
		
		displayVersion: function(oEvent) {
			var oVersion = oEvent.getSource().getBindingContext().getObject();
			this.launchVersionPage(null, oVersion);
		},
		
		addReadonlyForAllVersions: function(offerData) {
			var versions = [];
			if (offerData.Versions) {
				offerData.Versions.forEach(function(version) {
					version.Readonly = offerData.Readonly;
					versions.push(version);				
				});
			}
			return versions;
		},
		versionPage: function(channel, event, context) {
			this.launchVersionPage(null, null, context.oData);
		},
		setSaveCallback: function(fSaveCallback) {
			this._callbackSave = fSaveCallback;
		},
		
		handleManageVersionPress: function() {
			var view = this.getView();	
			if(this.state.getOfferData().OfferId !== null) {
				this.launchVersionPage(null, null);
				return;
			}
			this._callbackSave();
		},
		
		resetData: function() {
			this.locationHierarchy = null;
			this.ChangedHierarchy = false;
		}, 
		
		launchVersionPage: function(localNodes, selected, oData) {
			var offerData = oData || this.state.processor.createSavePayloadWithFinancials();
			var readOnly = offerData.Readonly;
			this.state.storeTransientSnapshot(offerData);
			this.state.store(offerData, {});
			//var offerData = this.state.getOfferData();
			offerData.Readonly = readOnly;
			var staticData = this.dataProvider.getStaticData();
			var selectedVersion = selected;
			if (selectedVersion) {
				var versionIndex = getVersionIndex(offerData.Versions, selectedVersion);
				selectedVersion = offerData.Versions[versionIndex];
				selectedVersion.Readonly = offerData.Readonly;
			}
			var hierarchy = this.contentModel.getProperty("/Hierarchy");
			if (this.locationHierarchy && this.locationHierarchy.length > 0 && !this.ChangedHierarchy) {		
				offerData.LocationHierarchy = this.locationHierarchy;
			} else {
				offerData.LocationHierarchy = Utils.buildLocationHierarchyFromVH(hierarchy);
				this.ChangedHierarchy = false;
			}
			this.locationHierarchy = offerData.LocationHierarchy;
			
			offerData.Versions = this.addReadonlyForAllVersions(offerData);
			
			createVersionsManagePage(offerData, staticData, this.dataProvider, selectedVersion, this.getRouter(), true);
		},
		
		getSelectedVersions: function () {
			this.versions = this.getView().byId("versionsTable");
	   		return this.versions.getSelectedItems().map(function (item) {
				return item.getBindingContext().getObject();
			});
		},
		resetTermsTab : function(style, packageOffer){
			var versions = this.oModel.getProperty("/VersionItems") || [];
			
			versions.forEach(function(version){
				version.Terms = [];
				version.TermStyle = style;
				version.PackageOffer = packageOffer;
			});
			
			this.oModel.refresh(true);
		}
	});
});