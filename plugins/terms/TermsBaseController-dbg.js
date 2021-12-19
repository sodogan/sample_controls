/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
   		"sap/ui/core/mvc/Controller",
   		"retail/pmr/promotionaloffers/utils/Models"
   	], function(Controller, Models) {
	
	
	var throwNotImplemented = function(method){
		return function(){
			throw new Error("Not implemented: " + method);
		};
	};
	
	var TermsBaseController = Controller.extend("retail.pmr.promotionaloffers.plugins.terms.TermsBaseController", {
		getOfferData : throwNotImplemented("getOfferData"),
		setOfferData : throwNotImplemented("setOfferData"),
		validate : throwNotImplemented("validate")
	});
	
	TermsBaseController.getter = function getter(propertyName){
		return function(){
			return this[propertyName];
		};
	};
	TermsBaseController.getValidId = function getValidId(/*nullValues*/){
		var possibleValues = Array.prototype.splice.call(arguments, 0);
		possibleValues.push("", null);
		var hasAnyValue = function(id){
			return possibleValues.reduce(function(result, currentItem){
				return result || currentItem === id;
			}, false);
		};
		return function(id){
			return hasAnyValue(id) ? "" : id;	
		};
	};
	
	TermsBaseController.hasValueForProperties = function hasValueForProperties(object, properties){
		return properties.reduce(function(result, property){
			if(!object[property]){
				return result + 1;
			}
			return result;
		}, 0);
	};
	
	return TermsBaseController; 
	
	
});