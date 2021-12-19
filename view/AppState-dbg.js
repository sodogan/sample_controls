/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){
	
	function AppState(){
		this.processor = null;
		this.transientData = null;
		this.offerData = null;
		this.staticData = null;
		this.transientSnapshot = null;
		this.valid = false;
	}
	
	AppState.prototype.createSnapshot = function(){
		var snapshot = {};
		if (this.transientSnapshot) {
			snapshot = this.transientSnapshot;
		} else {
			snapshot = this.processor.createSavePayload();
		}
		this.processor.storeSnapshot(snapshot);
	};
	
	AppState.prototype.setCommunicationProcessor = function(processor){
		this.processor = processor;
	};
	
	AppState.prototype.invalidate = function(){
		this.transientSnapshot = null;
		this.valid = false;
	};
	
	AppState.prototype.validate = function(){
		this.valid = true;
	};
	
	AppState.prototype.storeValid = function(){
		this.oldValid = this.valid;
	};
	
	AppState.prototype.storeBack = function(value){
		this.historyBack = value;
	};
	
	AppState.prototype.restoreValid = function(){
		if (this.oldValid) {
			this.valid = this.oldValid;
			this.oldValid = null;
		}
		
	};
	
	AppState.prototype.load = function(done){
		var processor = this.processor;
		var that = this;
		if(this.valid || this.historyBack){
			this.historyBack = false;
			return new Promise(function(resolve){
				setTimeout(function(){		
					done();
					resolve();	
				}, 100);//this looks weird, but it fixes a problem with link rendering, where style don't get applied and they look like regular buttons
			});
		}
		return processor.onInit(function(){
			that.offerData = processor.getOfferData();
			that.staticData =  processor.getStaticData();
			that.valid = true;
			this.historyBack = false;
			that.transientData = null;
			done();
		});
	};
	
	AppState.prototype.storeTransientSnapshot = function(transientSnapshot) {
		this.transientSnapshot = transientSnapshot || this.processor.getSnapshot();
		delete this.transientSnapshot.Readonly;
	};
	
	AppState.prototype.setTransientSnapshot = function(oTransientSnapshot){
		this.transientSnapshot = oTransientSnapshot || this.processor.getSnapshot();
	};
	
	AppState.prototype.store = function(/*arguments*/){
		this.transientData = Array.prototype.splice.call(arguments, 0);
	};
	
	AppState.prototype.storeLocationSubgroups = function(subGroup){
		this.locationSubgroups = subGroup;
	};
	
	AppState.prototype.getLocationSubgroups = function(){
		return this.locationSubgroups || [];
	};
	
	AppState.prototype.getSavePayload = function(){
		var payload = this.processor.createSavePayload();
		delete payload.Readonly;
		return payload;
	};
	
	AppState.prototype.getSavePayloadWithFinancials = function(){
		return this.processor.createSavePayloadWithFinancials();
	};
	
	AppState.prototype.getOfferData = function(){
		var args = [true, {}, this.offerData].concat(this.transientData);
		var offer = jQuery.extend.apply(jQuery, args);
		// the extend is not cloning the version array correctly (always he gets the bigger one ex: in delete case of version)
		if (this.transientData) {
			var updatedData = this.transientData[0];
			if (updatedData.LocationHierarchy) {
				offer.LocationHierarchy = updatedData.LocationHierarchy;
			}
			
			if(updatedData.LocationSubgroups) {
				offer.LocationSubgroups = updatedData.LocationSubgroups;
			}
			
			offer.LocalNodes = updatedData.LocalNodes;
			offer.ExcludedNodes = updatedData.ExcludedNodes;
			offer.LocationFilters = updatedData.LocationFilters;
			offer.Versions = updatedData.Versions;
			offer.Terms = updatedData.Terms;
		}	
		if(!offer.PackageOffer){
			delete offer.PackageValue;
		}
		return offer;
	};
	
	AppState.prototype.getStaticData = function(){
		return this.staticData;
	};
	
	AppState.prototype.hasChanges = function(){
		return this.processor.hasChanges();
		
	};
	
	AppState.prototype.calculateFinancials = function(payload){
		return this.processor.calculateFinancials(payload);
	};
	
	AppState.prototype.determineVendorFunds = function(payload){
		return this.processor.determineVendorFunds(payload);
	};
	
	AppState.prototype.calculateForecast = function(payload){
		return this.processor.calculateForecast(payload);
	};
	
	AppState.prototype.detectCollisions = function(payload){
		return this.processor.detectCollisions(payload);
	};
	
	AppState.prototype.save = function(){
		var that = this;
		this.transientData = null;
		return that.processor.saveOffer(this.getOfferData()).then(function(result){
			that.valid = true;
			return that.processor.processData(result).then(function(offerData){
				that.offerData = offerData;
				return result;
			});
		});
	};
	
	return AppState;
}, true);