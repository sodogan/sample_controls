/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
       		"jquery.sap.global",
       		"retail/pmr/promotionaloffers/utils/Models",
       		"retail/pmr/promotionaloffers/utils/Utils",
       		"sap/ui/model/json/JSONModel",
       		"retail/pmr/promotionaloffers/Component"
    	], function(jQuery, Models, Utils, JSONModel, Component) {
	"use strict";
 	
 	var setHeaderFieldsBusyState = function(state, controls){
		controls.forEach(function(ctrl) {
			if(ctrl) {
				var tiles = ctrl.getContent();
				for(var i = 0, iLen = tiles.length; i < iLen; i++){
					tiles[i].setBusy(state);
				}
			}
		});			
	};
	
	function OfferOperations (state) {
		this.state = state;
	}
	
	OfferOperations.prototype.calculateFinancials = function(aFinHeaderFields, clonePayload) {
		var payload = clonePayload ? clonePayload : this.state.getSavePayload();
		setHeaderFieldsBusyState(true, aFinHeaderFields);
		return this.state.calculateFinancials(payload).then(function(data){
			setHeaderFieldsBusyState(false,  aFinHeaderFields);
			return data;
		}, function(){
			setHeaderFieldsBusyState(false,  aFinHeaderFields);
		});
	};
	
	OfferOperations.prototype.getForecast = function(aForecastHeaderFields) {
		setHeaderFieldsBusyState(true, aForecastHeaderFields);
		return this.state.calculateForecast(this.state.getSavePayload()).then(function(data) {
			setHeaderFieldsBusyState(false,  aForecastHeaderFields);
			return data;
		}, function() {					
			setHeaderFieldsBusyState(false, aForecastHeaderFields);
		});
	};
	
	OfferOperations.prototype.setHeaderFieldsBusyState = function(state, controls) {
		setHeaderFieldsBusyState(state, controls);
	};
	
	OfferOperations.prototype.detectCollision = function() {
			
			var oService = sap.ushell.Container.getService("CrossApplicationNavigation");
			var oConfig = Component.getMetadata().getConfig();
			var sPrefix = oConfig.displayOfferUrl;
			
			var that = this;
			return new Promise(function(resolve, reject){
				var oCollisionDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.CollisionDetectionDialog", {
					onCollisionDialogConfirm: function() {
						oCollisionDialog.close();
					},
					
					onAfterClose: function() {
						resolve();
						oCollisionDialog.destroy();
						oCollisionDialog = null;
					},
					
					displayCollision: function(oEvent) {
						//If possible open collision in new window
		   				if (oService) {
		   					var sOfferId = oEvent.getSource().getBindingContext().getProperty("OfferId");
		   					var sHash = sPrefix + Utils.base64ToHex(sOfferId);
		   					var oLink = {
								target : { shellHash : sHash }
							};
							var sHref = oService.hrefForExternal(oLink);
							var oValidation = oService.isIntentSupported([sHref]);
							oValidation.done(function(oResponse) { 
								if (oResponse[sHref].supported === true) { 
									var sUrl = jQuery(location).attr("href").split("#")[0] + sHref;
									jQuery.sap.log.info("Opening new window " + sUrl);
									sap.m.URLHelper.redirect(sUrl, true);
								} else { 
									jQuery.sap.log.error("Cannot navigate to display offer"); 
								}
							}).fail(function() { 
								jQuery.sap.log.error("Cannot navigate to display offer");	
							});
		   				} else {
		   					jQuery.sap.log.error("Cross app navigation service is missing");
		   				}
					},
					
			   		onBeforeRebind: function(oEvent) {
	   		   			var oBindingParams = oEvent.getParameter("bindingParams");
	   		   			var query = oBindingParams.parameters.select;
	   		   			var fieldsFromSort = Utils.getFieldsFromSort(oBindingParams.sorter);
	   		   			oBindingParams.parameters.select = Utils.attachFieldsToQuery(
	   		   				["OfferId", "Editable", "OfferSetId", "PromotionType", "MasterdataSystem", 
	   		   				 "PurchasingGroup", "PurchasingGroupName","LeadingCategoryName", "LeadingCategory"].concat(fieldsFromSort), query);
	   		   			
	   		   			var filtersToAdd = [];
	   		   			var filter = {};
	   		   			if(that.oCollisionsOffers && that.oCollisionsOffers.length > 0) {
	   		   				for(var i = 0, iLen = that.oCollisionsOffers.length; i < iLen; i++) {
	   		   					filter = new sap.ui.model.Filter({	   		   				
	   			   		   			path: "ExtOfferId",
	   				   		   	    operator: "EQ",
	   				   		   	    value1: "" + that.oCollisionsOffers[i].ExtOfferId
	   		   		   			});
	   		   					
	   		   					filtersToAdd.push(filter);
	   		   				}
	   		   			} else {
		   		   			filter = new sap.ui.model.Filter({	   		   				
			   		   			path: "ExtOfferId",
				   		   	    operator: "EQ",
				   		   	    value1: "-1",
				   		   	    value2: ""
		   		   			});	   		   			
		   		   			filtersToAdd.push(filter);
	   		   			}	   		   			
	   		   			var fltrs = new sap.ui.model.Filter({
	   		   				filters: filtersToAdd,
	   		   				and: false
	   		   			});   		   			
	   		   			oBindingParams.filters.push(fltrs);
			   		}			   		
				});
				
				that.isCollOpen = true;
				oCollisionDialog.setModel(Utils.getResourceModel(), "i18n");
				
				//Define settings
				var oSettingsModel = new JSONModel({ "linkEnabled" : false});
				oCollisionDialog.setModel(oSettingsModel, "settings");
				
				//Enable linkl only if navigation is supported
				if (oService) {
					var sHref = oService.hrefForExternal({ target : { shellHash : sPrefix } });
					var oValidation = oService.isIntentSupported([sHref]);
					oValidation.done(function(oResponse) { 
						if (oResponse[sHref].supported === true) { 
							var oModel =  new JSONModel({ "linkEnabled" : true});
							oCollisionDialog.setModel(oModel, "settings");
						} 
					});
				}				
				resolve(oCollisionDialog);
			}.bind(this));
		};
		
		OfferOperations.prototype.populateCollisionDetection = function(oCollisionDialog, payload, view) {			
			return this.state.detectCollisions(payload).then(function(data) {   				
				this.oCollisionsOffers = data.data.filter(function(item){
					return item.OfferId !== payload.OfferId;
				});
				oCollisionDialog.setModel(Models.getServiceModel());
				view.addDependent(oCollisionDialog);
				oCollisionDialog.open();
				this.isCollOpen = false;
				return data;
			}.bind(this), Utils.handleErrors);
		};   	
	return OfferOperations;
}, /* bExport= */ true);