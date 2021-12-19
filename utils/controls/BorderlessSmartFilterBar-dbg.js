/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/comp/smartfilterbar/SmartFilterBar"], function(SmartFilterBar){
	"use strict";
	
	return SmartFilterBar.extend("retail.pmr.promotionaloffers.utils.controls.BorderlessSmartFilterBar", {
		renderer: SmartFilterBar.getMetadata().getRenderer(),
		onAfterRendering : function(){
			this.$().css({
				"border" : "0 solid black",
				"padding-top" : 0,
				"padding-left" : 0,
				"padding-right" : 0
			});
		}
	});

});