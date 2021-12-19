/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/Control"], function(Control){
	return Control.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.Separator", {
		renderer : {
			render : function(rm, oControl){
				if(oControl.getVisible()){
					rm.write("<hr>");
				}
			}
		}
	});
});