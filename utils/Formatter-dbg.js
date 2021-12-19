/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"retail/pmr/promotionaloffers/utils/Utils",
	"retail/pmr/promotionaloffers/utils/Models"
	],
	function(Utils, Models) {
	"use strict";
	
	var _oShortDateFormatter = sap.ui.core.format.DateFormat.getDateTimeInstance({style:"short"});
	var _oMediumDateFormatter = sap.ui.core.format.DateFormat.getDateInstance({style:"medium", UTC: true});
	
	var Formatter = {
		isText : true,
		isImage : false,
		isDate: false,
		
		dateFormat: function(value){
			return value ? retail.pmr.promotionaloffers.utils.Utils.dateMedium(value) : null;
		},
		_resetFields: function(){
			this.isText = false;
			this.isImage = false;
			this.isDate = false;
		},
		setText: function(bValue){
			this._resetFields();
			this.isText = bValue;
		},
		setImage: function(bValue){
			this._resetFields();
			this.isImage = bValue;
		},
		setDate: function(bValue){
			this._resetFields();
			this.isDate = bValue;
		},	
		editableAttribute : function(flag) {
			if (flag !== "X") {
				return true;
			}
			return false;
		},
		attributeTypeImage : function(flag) {
			if (flag === "Image") {
				return true;
			}
			return false;
		},
		attributeTypeInput : function(flag) {
			if (flag === "Input") {
				return true;
			}
			return false;
		},
		attributeTypeText : function(flag) {
			if (flag === "Text") {
				return true;
			}
			return false;
		},
		attributeTypeDate : function(flag) {
			if (flag === "Date") {
				return true;
			}
			return false;
		},
		
		dateTimeShortFormatter: function(timestamp) {
			if (timestamp) {
				return _oShortDateFormatter.format(timestamp);
			} else {
				return "";
			}
		},

		salesProfitFormat: function(param,currency){
			return param + " " + currency;
		},
		
		percentFormat: function(margin){
			return margin + "%";
		},
		
		datesFormatterForManageOffer : function(from, to) {
			var oFrom = Utils.getFormatedDateForRead(from);
			var oTo = Utils.getFormatedDateForRead(to);
			return retail.pmr.promotionaloffers.utils.Utils.getDateRange(oFrom, oTo);
		},
		
		datesShortFormatter: function(from, to) {
		
			return retail.pmr.promotionaloffers.utils.Utils.getDateRange(from, to);
		},
		
		lastChangedByFormatter: function(sChangedByName, sChangedOn) {
			return sChangedByName + "\n" + retail.pmr.promotionaloffers.utils.Utils.dateMedium(sChangedOn);
		},
		locationPickerHideIfEmpty: function(firstParam, secondParam, thirdParam, versionNameParam, nameParam, isClosed){
			var p1 = firstParam || "";
			var p2 = secondParam || "";
			var name = nameParam || "";
			var versionName = versionNameParam || "";
			var closeString = Utils.getResourceModel().getResourceBundle().getText("Locations.Closed.Store.Short");
			
			var checkIsClosed = function(base){
				return isClosed ? base + "[" + closeString + "]" : base;
			};
			
			if (thirdParam) {
				return checkIsClosed(versionName || thirdParam);
			}
			
			var id = p1 || p2;
			if (name && id) {
				return checkIsClosed(versionName || (name + " (" + id + ")"));				
			} else {
				return checkIsClosed(versionName || p1 || p2);
			}
		},
		numberOfProductRows: function(param) {
			if (param && param > 1) {
				return 10;
			}
			return 1;
		},
		formatBlockDate: function(firstParam, secondParam){
			if (!firstParam && secondParam) {
				return "-" + retail.pmr.promotionaloffers.utils.Formatter.utcDate(secondParam);
			} else if (firstParam && !secondParam) {
				return retail.pmr.promotionaloffers.utils.Formatter.utcDate(firstParam) + "-";
			} else if (!firstParam && !secondParam){
				return "";
			}
			
			return retail.pmr.promotionaloffers.utils.Formatter.utcDate(firstParam) + " - " + 
				   retail.pmr.promotionaloffers.utils.Formatter.utcDate(secondParam);
		},
		formatDescripTionIdType: function(firstParam, secondParam){
			if (!firstParam && secondParam) {
				return secondParam;
			} else if (firstParam && !secondParam) {
				return firstParam;
			} else if (!firstParam && !secondParam){
				return "";
			}
			
			return firstParam + " (" + secondParam + ")";
		},
		summaryLine: function(label, date, week) {
			return label + " " + date + " (" + week + ")";
		},
		positiveNegativeNumberformat: function(number) {
			if (number > 0) {
				return "Success";
			} else if (number < 0) {
				return "Error";
			}			
		},
		marginColorformat: function(number) {
			if (number > 0) {
				return sap.m.ValueColor.Good;
			} else if (number < 0) {
				return sap.m.ValueColor.Critical;
			}			
		},	
		marginIndicatorformat: function(number) {
			if (number > 0) {
				return sap.m.DeviationIndicator.Up;
			} else if (number < 0) {
				return sap.m.DeviationIndicator.Down;
			} else {
				return sap.m.DeviationIndicator.None;
			}		
		},	
		locationFormat: function(param1){
			return param1;
		},
		isCalculateVisible: function(editable, feature) {
			if (editable && feature === "X") {
				return true;
			} else {
				return false;
			}
		},
		colorFormatter: function(excluded) {
			if(excluded){
				return "sapThemeCriticalText";
			}				
			
			return "sapThemeDarkText";
		},
		breadCrumbFormatter: function(crumb) {
			var toReturn = "";
			if(crumb && crumb.length > 0 && crumb.length > 200){				
				toReturn = crumb.substring(0,197) + "...";
			}else{
				toReturn = crumb;
			}
			
			return toReturn;
		},
		utcDate: function(value) {
			//Input is just a number
			var date = new Date(value);
			return _oMediumDateFormatter.format(date);
		},
		mergeWithComma: function(val1, val2) {
			if (val1 && val2) {
				return val1 + ", " + val2;
			} else {
				var v1 = val1 ? val1 : "";
				var v2 = val2 ? val2 : "";
				return v1 + v2;
			}
		},
		showParentNodeOnly: function(virtualParentId){
			if(Utils.isInitial(virtualParentId)){
				return true;
			}
			
			return false;
		},
		popoverShowIncludeValue: function(sign){
			if(sign && sign.toUpperCase() === "I"){
				return true;
			}
			
			return false;				
		},
		marketingArea: function(desc, id){
			if(!desc && !desc.length) {
				return id;
			}
			return desc;
		},
		popoverShowExcludeValue: function(sign){
			if(sign && sign.toUpperCase() === "E"){
				return true;
			}
			
			return false;				
		},
		tableShowFilterIcon: function(filters){
			if(filters){
				var countFilters = JSON.parse(filters);				
				if(countFilters.length > 0){
					return true;
				}				
			}
			
			return false;
		},
		showTextLikeToken: function(low,high,sign,operation){
			if(operation){
				return Utils.getTextLikeToken(low,high,sign,operation);
			}
			
			return "";
		},
		filterModified: function(filterModified){
			if(filterModified){
				return true;
			}
			
			return false;
		},
		cardinalityFormatter: function(cardinality,maxCardinality){
			if(cardinality && maxCardinality){
				return cardinality === maxCardinality ? cardinality : cardinality + "/" + maxCardinality;
			}
			
			return cardinality || maxCardinality;
		},
		fullLocationNodeDescription: function(node, stores) {
			return node + " " + stores;
		},
		tableNodeName: function(name, extId) {
			if(!extId) {
				return name;
			}
			if (extId === name) {
			  return extId;
			}
			return name + " (" + extId + ")"; 

		},
		forecastConfidence: function(confidence) {
			var aIntervals = Models.getForecastConfidence();
			
			if (aIntervals.length < 3) {
				return confidence;
			}
					
			var fValue = parseFloat(confidence, 10);
			var fLowMax = parseFloat(aIntervals[0].Value);
			var fMediumMax = parseFloat(aIntervals[1].Value);
			var fHighMax = parseFloat(aIntervals[2].Value);
			
			if (fValue <= fLowMax) {
				return Utils.getResourceModel().getProperty("ForecastConfidence.Low");
			} else if (fValue <= fMediumMax) {
				return Utils.getResourceModel().getProperty("ForecastConfidence.Medium");
			} else if (fValue <= fHighMax) {
				return Utils.getResourceModel().getProperty("ForecastConfidence.High");
			} else {
				return confidence;
			}
		},
		forecastConfidenceState: function(confidence) {
			var aIntervals = Models.getForecastConfidence();
			
			if (aIntervals.length < 3) {
				return sap.ui.core.ValueState.None;
			}
					
			var fValue = parseFloat(confidence, 10);
			var fLowMax = parseFloat(aIntervals[0].Value);
			var fMediumMax = parseFloat(aIntervals[1].Value);
			var fHighMax = parseFloat(aIntervals[2].Value);
			
			if (fValue <= fLowMax) {
				return sap.ui.core.ValueState.Error;
			} else if (fValue <= fMediumMax) {
				return sap.ui.core.ValueState.Warning;
			} else if (fValue <= fHighMax) {
				return sap.ui.core.ValueState.Success;
			} else {
				return sap.ui.core.ValueState.None;
			}
		},
		productCount: function(sCount) {
			var i18n = Utils.getI18NModel();
			var sText = i18n.getResourceBundle().getText("Dynamic");
		 	return parseInt(sCount, 10) < 0 ?  sText : sCount; 
		}
	};
	return Formatter;

}, /* bExport= */ true);