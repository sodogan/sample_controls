/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"], function(Utils){
	"use strict";
	var oStatuses = {
		RECOMENDED_STATUS  : "04",
		APPROVED_STATUS : "06"
	};
	var UIStates = {
			EDITABLE_ALL_OFFER: 0,
	   		EDITABLE_HEADER: 5,
	   		READONLY: 10
		};
	function StatusHandler(statusField) {
		this.stateField = statusField || "Status"; // default value
	}
	/**
	 * Used to set the field name. The default value is 'Status'.
	 * @param {string} Field name
	 * @returns {void}
	 */
	
	StatusHandler.prototype.setFieldName = function(statusField) {
		this.stateField = statusField;
	};
	/**
	 * Used to get the field name.
	 * @returns {string} Field name
	 */
	
	StatusHandler.prototype.getFieldName = function(statusField) {
		return this.stateField || "Status";
	};
	/**
	 *  Check if the offer header is editable
	 *  @param value The status value
	 *  @returns {boolean} The editable check	
	 */
	StatusHandler.prototype.getEditableHeader = (function() {
		var options = {
			getStatus: 	function (value) {
				return value.Status === oStatuses.RECOMENDED_STATUS;
			},
			getUIState: function getUIState(value) {
				return value.UIState === UIStates.EDITABLE_HEADER;
			}
		};
		
		return function(value) {
			return options["get" + this.getFieldName()](value);
		};
	}());
	
	/**
	 *  Check if the offer is read only
	 *  @param value The status value
	 *  @returns {boolean} The read only check	
	 */
	StatusHandler.prototype.getReadOnly = (function() {
		var options = {
			getStatus: 	function (value) {
				return value.Status === oStatuses.APPROVED_STATUS;
			},
			getUIState: function getUIState(value) {
				return value.UIState === UIStates.READONLY;
			}
		};
		
		return function(value) {
			return options["get" + this.getFieldName()](value);
		};
	}());
	
	/**
	 *  Returns the status object used for store
	 *  @param value The status value
	 *  @returns {object} The status object
	 */
	StatusHandler.prototype.getObjectForStore = (function() {
		var options = {
			getStatus: 	function (value) {
				return { 
					Status: value.Status
				};
			},
			getUIState: function getUIState(value) {
				return { 
					UIState: value.UIState,
					Status: value.Status
				};
			}
		};
		
		return function(value) {
			return options["get" + this.getFieldName()](value);
		};
	}());
	/**
	 * Used to get the field that needs for smart table search
	 * @returns {array} Returns an empty array if it's not mandatory or an array with the field name
	 */
	StatusHandler.prototype.getFieldForSearch = (function() {
		var options = {
			getStatus: 	function () {
				return [];
			},
			getUIState: function getUIState() {
				return ["UIState"];
			}
		};
		
		return function() {
			return options["get" + this.getFieldName()]();
		};
	}());
	
	/**
	 * Used to get the field that needs for smart table search
	 * @returns {array} Returns an empty array if it's not mandatory or an array with the field name
	 */
	StatusHandler.prototype.getObjectStatusState = (function() {
		var options = {
			getStatus: 	function (value) {
				switch (value.Status) {
		  			case oStatuses.APPROVED_STATUS: return "Success";
		  			case oStatuses.RECOMENDED_STATUS: return "Warning";
		  			default: return null;
				}
			},
			getUIState: function getUIState(value) {
				switch (value.UIState) {
		  			case UIStates.READONLY: return "Success";
		  			case UIStates.EDITABLE_HEADER: return "Warning";
		  			default: return null;
			   }
			}
		};
		
		return function(value) {
			return options["get" + this.getFieldName()](value);
		};
	}());
	
	
	return StatusHandler;
}, /* bExport= */ true);