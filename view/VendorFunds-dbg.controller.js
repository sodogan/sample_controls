/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
        "sap/ui/core/mvc/Controller", 
   		"retail/pmr/promotionaloffers/utils/Utils",
   		"sap/ui/model/json/JSONModel",
   		"retail/pmr/promotionaloffers/utils/Formatter"
   	], function(Controller, Utils, JSONModel, Formatter) {
   	"use strict";
   	
   	return Controller.extend("retail.pmr.promotionaloffers.view.VendorFunds", {
   		onInit : function() {  
   			this.contentModel = new JSONModel();
   			this.getView().setModel(this.contentModel, "ContentModel");
   			this.contentModel.setProperty("/CreateButtonEnabled", false);

   			this.vendorTable = this.getView().byId("vendorTable");
   		},
   		
   		createOffer : function() {
   			var item = this.vendorTable.getSelectedItem().getBindingContext().getObject();
   			this.getRouter().navTo("vendorFundsCreate", {
   				path : item.Id
   			});
   		},
   		
   		cancel : function() {
   			var oHistory = sap.ui.core.routing.History.getInstance();
   			var sPreviousHash = oHistory.getPreviousHash();
   			if (sPreviousHash !== undefined) {
        		window.history.go(-1);
    		} else {
    			this.getRouter().navTo("manage");
			}
   			
   			this.vendorTable.removeSelections();
   			this.updateButtons();
   		},
   		
   		updateButtons : function() {
   			this.contentModel.setProperty("/CreateButtonEnabled", this.vendorTable.getSelectedItems().length > 0);
   		},

   		onBeforeRebindTable : function(oEvent) {
   			var oBindingParams = oEvent.getParameter("bindingParams");
            var query = oBindingParams.parameters.select;
            var fieldsFromSort = Utils.getFieldsFromSort(oBindingParams.sorter);
            oBindingParams.parameters.select = Utils.attachFieldsToQuery(["Id"].concat(fieldsFromSort), query);
        },
        
        onDataReceived: function() {
        	this.updateButtons();
        },
   		
        getRouter : function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		}
		
   	});

});