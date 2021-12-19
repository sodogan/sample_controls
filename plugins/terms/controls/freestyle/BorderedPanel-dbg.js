/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Panel", "sap/m/PanelRenderer"], function(Panel, PanelRenderer){
	"use strict";

	return Panel.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.BorderedPanel", {
		persistencyKey: "",
		
		config: "",
		
		init : function(){
			Panel.prototype.init.apply(this, arguments);	
		},
		
		renderer: PanelRenderer.render,
		
		onAfterRendering : function(){
			this.$().find(".sapMPanelBGTranslucent.sapMPanelContent").css({
				borderLeft : "1px solid #dddddd",
				borderRight : "1px solid #dddddd"
			});
		}
	});
});