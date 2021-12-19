/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/OverflowToolbar"], function(Toolbar){
	"use strict";

	return Toolbar.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.BorderlessToolbar", {
		onAfterRendering : function(){
			var domRef = this.getDomRef();
			domRef.style.border = 0;
			domRef.style.paddingLeft = 0;
		}
	});
});