/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
   		"jquery.sap.global",
   		"sap/ui/core/mvc/Controller",
   		"sap/ui/model/json/JSONModel",
   		"retail/pmr/promotionaloffers/utils/Utils"   		
   	], function(jQuery, Controller, JSONModel, Utils) {
   	"use strict";
   	
   	/**
   	 * Checks if a fund is Selected in the UI.
   	 * 
   	 * @param {object} fund - a vendor fund from the UI model.
   	 * @return {boolean} true if the fund is selected
   	 */
   	function isSelected(fund){
		return fund.Selected;
	}
   	
	/**
	 * @param {object} fund - a vendor fund from the UI model
	 * @return {object} a vendor fund that can be sent to the server 
	 */
	function fundForPayload(fund){
		var fundClone = jQuery.extend(true, {}, fund);
		delete fundClone.Selected;
		return fundClone;
	}
       	
   	var VendorFundController = Controller.extend("retail.pmr.promotionaloffers.plugins.VendorFund", {
   		
   		constructor : function(){
   			Controller.apply(this, arguments);
   			this.dataProvider = null;
   			this.oModel = new JSONModel();
   			this.contentModel = new JSONModel();
   			
   		},
   		
   		onInit : function() {
   			this.contentModel.setData({
   				Editable : true
   			});
   			this.getView().setModel(this.oModel);
   			this.oBusyVendorFund = this.getView().byId("busyVendorFunds");
   			this.getView().setModel(Utils.getResourceModel(), "i18n");
   			this.getView().setModel(this.contentModel, "Content");
   			this.appState = this.getOwnerComponent().getState();
   		},
   		
		/**
   		 * Resets the view.
   		 * 
   		 * @returns {void}
   		 */
   		resetView: function() {
   			this.oModel.setData({});
   		},

   		validateForm: function() {
   			return 0;
   		},   		
   		selectAssociatedVendorFunds : function(available, associated){
   			if(!associated.length) {
   				return;
   			}
			for(var i = 0; i < available.length; i++){
   				for(var j = 0; j < associated.length; j++){
	   				if(associated[j].Id === available[i].Id){
	   					available[i].Selected = true;
	   				
	   				}
   				}
   			}
		},
		reselectAssociatedVendorFunds : function(available, associated){
   			if(!associated.length) {
   				return;
   			}
			for(var i = 0; i < available.length; i++){
   				
   				for(var j = 0; j < associated.length; j++){
	   				if(associated[j].Id === available[i].Id  && associated[j].Selected){
	   					available[i].Selected = true;
	   				
	   				}
   				}
   			}
		},
		setOfferData : function(data){
			var availableFunds = jQuery.extend(true, [], data.AvailableFunds);
   			var vendorFunds = jQuery.extend(true, [], data.VendorFunds);
   			if(!data.CreatedOn) {
   				this.selectAllVendors(availableFunds);
   			}
   			else {
   				this.selectAssociatedVendorFunds(availableFunds, vendorFunds);		
   			}
   			
   			this.contentModel.setProperty("/Editable", !data.Readonly);
   			this.oModel.setProperty("/VendorFunds", vendorFunds);
   			if(data.Readonly) {
   				this.oModel.setProperty("/AvailableFunds", vendorFunds);
			} else {
				this.oModel.setProperty("/AvailableFunds", availableFunds);
   			}
   		},
   		
   		getOfferData: function(){
   			var avaialbleFunds = this.oModel.getProperty("/AvailableFunds") || [];
   			return {
   				VendorFunds : avaialbleFunds.filter(isSelected).map(fundForPayload)
   			};
   		},
   		fetchVendorFunds : function(payload){
   			return this.appState.determineVendorFunds(payload);
   		},
   		setDataProvider : function(loader){
   			this.dataProvider = loader;
   		},
   		selectAllVendors: function(available){
   			for(var i = 0; i < available.length; i++){
				available[i].Selected = true;	
   			}
   		},
   		
   		cleanPaylodForVendorFunds: function (payload) {	
   			if (payload) {
   				if (payload.Versions) {
   					for (var i = 0; i < payload.Versions.length; i++) {
   						var version = payload.Versions[i];
   						delete version.LocalNodes;
   						delete version.locationPath;
   						Utils.cleanFinancialsForVersion(version);
   					}
   	   	   		}	
   				Utils.cleanFinancialsForVersion(payload);
   	   	   		delete payload.LocationHierarchy;
   			}
   	   		return payload;
   	   	},
   		
   		retrieveVendorFunds  : function(){
   			this.oBusyVendorFund.open();
   			var clonePayload = jQuery.extend(true, {}, this.dataProvider.getSavePayload());
   			var payload = this.cleanPaylodForVendorFunds(clonePayload);
   			return this.fetchVendorFunds(payload).then(function(result){
   				var availableFunds = result.data;
   				var associatedFunds = this.oModel.getProperty("/AvailableFunds") || [];
   				if(associatedFunds.length !== 0) {
   					this.reselectAssociatedVendorFunds(availableFunds, associatedFunds);
   				}
   				else {
   					this.selectAllVendors(availableFunds);	
   				}
   				this.oModel.setProperty("/AvailableFunds", availableFunds);
   				this.oBusyVendorFund.close();
   			}.bind(this), function(e){
   				this.oBusyVendorFund.close();
   			}.bind(this));
   		}
   	});

   	return VendorFundController;
});
