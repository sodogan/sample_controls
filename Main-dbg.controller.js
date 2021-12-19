/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
  		"sap/ui/core/mvc/Controller",
  		"retail/pmr/promotionaloffers/utils/Utils",
  		"retail/pmr/promotionaloffers/utils/Models"
  	], function(Controller, Utils, Models) {
  	"use strict";

  	var MainController = Controller.extend("retail.pmr.promotionaloffers.Main", {

  		onInit : function() {
  			var model = this.getOwnerComponent().getModel();
  			Models.init(model);
  			Utils.setComponent(this.getOwnerComponent());
  		},
  		
  		onExit: function() {
  			if (this.app) {  		
  				this.app.getParent().destroyContent();
  			}
  		}
  	});
   	
	return MainController;
});