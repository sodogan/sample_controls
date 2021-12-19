/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], 
function(){
	
	var oBuilder = {};
	
	oBuilder._aViewCache = [];        
	
	oBuilder.getView = function(name, type, id) {
		
		var sKey = name + "##" + id + "##" + type;
		
		//Check cache first
		if (sKey in this._aViewCache) {
			return this._aViewCache[sKey];
		}

		//Create instance
		var oView = sap.ui.view({
			viewName : name,
			type : type
		});
		
		this._aViewCache[sKey] = oView;
		
		return oView;
	};

	return oBuilder;
});