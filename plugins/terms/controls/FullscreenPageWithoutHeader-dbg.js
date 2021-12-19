/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/semantic/FullscreenPage"], function(FullscreenPage){
	"use strict";

	return FullscreenPage.extend("retail.pmr.promotionaloffers.plugins.terms.controls.FullscreenPageWithoutHeader", {
		onAfterRendering : function(){
			if(sap.ui.version <= "1.42.12") {
				var domRef = this.getDomRef();
				jQuery("div > header", domRef).first().hide();
				jQuery("div > section", domRef).first().css("top", "0px");
			}
		},
		renderer : sap.m.semantic.FullscreenPageRenderer
	});
});