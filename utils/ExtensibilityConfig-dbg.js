/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){
	"use strict";
	var _expand = [];
	var ExtensibilityConfig = {
		setExpand: function(expand) {
			_expand = expand;
		},

		getExpand: function() {
			if(_expand.length) {
				return "," +  _expand.join();
			}
			return "";
		}
	};
	
	return ExtensibilityConfig;
}, /* bExport= */ true);