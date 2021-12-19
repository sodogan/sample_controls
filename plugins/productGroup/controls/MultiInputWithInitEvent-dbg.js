/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/MultiInput", "sap/m/MultiInputRenderer"], function(MultiInput, MultiInputRenderer){
	return MultiInput.extend("retail.pmr.promotionaloffers.plugins.productGroup.controls.MultiInputWithInitEvent", {
		metadata : {
			properties : {
				initialized : { type : 'boolean', defaultValue : false }
			},
			events : {
				paste : {
					texts : { type : "any" }
				},
				initialize: {
					source : { type : "object" }
				}
			}
		},
		
		renderer: MultiInputRenderer.render,
		
		onAfterRendering : function(){
			if(!this.getInitialized()){
				this.fireInitialize({ source : this });
				this.setInitialized(true);
			}
		}
	});
});