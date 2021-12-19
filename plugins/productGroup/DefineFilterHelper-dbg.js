/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/Models",
               "sap/ui/comp/smartfilterbar/SmartFilterBar",
               "sap/ui/comp/smartfilterbar/ControlConfiguration",
               "retail/pmr/promotionaloffers/utils/Constants",
               "retail/pmr/promotionaloffers/plugins/productGroup/DefineUIBuilderHelper"], function(Utils,Models,SmartFilterBar,ControlConfiguration,Constants, UIBuilder){
	
	var DefineFilterHelper = function(smartFilterBar,dialog,dialogMode,filtersArry,hierarchy,intervals){
		var that = this;
		
		this.i18nBundle = Utils.getResourceModel().getResourceBundle();
		
		this.filters = [];
		this.sfbFilters = {};
		this.smartFilterBar = smartFilterBar;
		this.dialog = dialog;
		this.hierarchy = hierarchy;
		this.intervals = intervals;
		
		this.filters = jQuery.extend([],this.smartFilterBar._aFields);
	
		this.setFilters = function(filters,hierarchy,filtersModified){
			this._filters = filters;
			this._hierarchy =  hierarchy;
			this._filtersModified = filtersModified;
			function setFilterDeep(items){
				var radioOption = that.calculateRadioSelection();					
				for(var i=0,iLen=items.length;i<iLen;i++){
					var arry = [];
					
					for(var iter in filters){
						arry = arry.concat(that.createFilterForPayload(filters[iter], iter, items[i].Id));
					}
					
					if(radioOption !== Constants.APPLY_CHANGES_RADIO.All_unmodified_subnodes || !items[i].filterModified){
						that.sfbFilters[items[i].Id] = { filters : arry , ParentId: items[i].ParentId};
					}
						
					if(radioOption === Constants.APPLY_CHANGES_RADIO.All_unmodified_subnodes ||  radioOption === Constants.APPLY_CHANGES_RADIO.All_subnodes){
						if(items[i].children && items[i].children.length > 0){
							setFilterDeep(items[i].children);
						}
					}
				}
			}
			
			var selHierarchy = hierarchy || that.hierarchy; 
			if(Object.keys(filters).length > 0 && selHierarchy){
				if(that.calculateRadioSelection() === Constants.APPLY_CHANGES_RADIO.All_unmodified_subnodes){
					that.sfbFilters = jQuery.extend({},filtersModified);
				}
				var oldVal = selHierarchy.filterModified;
				delete selHierarchy.filterModified;
				setFilterDeep([selHierarchy]);
				selHierarchy.filterModified = oldVal; 
				setFilterDeep([selHierarchy]);
			}
		};
		
		this.getFilters = function(){
			var payloadFilters = this.createPayload();
			
			return payloadFilters;
		};
		
		this.getFiltersObject = function(){
			return {sfbFilters : this.sfbFilters, dialogRadioSelection: this.calculateRadioSelection()};
		};
		
		this.deleteFilter = function(id){
			delete this.sfbFilters[id];
		};
		
		var controlConfigurations = jQuery.extend([],this.smartFilterBar.getAggregation("controlConfiguration"));
		
		this.uiBuilderHelper = new UIBuilder(controlConfigurations,this.filters,dialogMode,this,filtersArry); 
		this.uiBuilderHelper.addRadioListener(function(e){
			this.sfbFilters = {};
			this.setFilters(this._filters, this._hierarchy, this._filtersModified);
		}.bind(this)); 
		this.dialog.addContent(this.uiBuilderHelper.getCtrlsForDialog());

		if(filtersArry && filtersArry.length > 0){
			this.editModeTokenToInputs(filtersArry);
		}
	};
	
	DefineFilterHelper.prototype.editModeTokenToInputs = function(filtersArry){
		var that = this;
		
		var itemsLikePayload = function(filter){
			return {
				key: filter.Low.replace(/[*=<>]/g,""),
				text: filter.Text
			};
		};
		
		var rangeLikePayload = function(filter){
			return {
				exclude: filter.Sign === Constants.SIGN_CONST.include() ? false : true,
				operation: that.convertToOperation(filter.Option,filter.Low,filter.High,filter.Sign),
				keyField: filter.Property,
				value1: filter.Low.replace(/[*=<>]/g,""),
				value2: filter.High.replace(/[*=<>]/g,""),
				tokenText: filter.Low
			};
		};
		
		var rangeLikePayloadExclude = function(filter){
			return {
				exclude: true,
				operation: Constants.OPTION_CONST.eq(),
				keyField: filter.Property,
				value1: (filter.Low.replace(/[*=<>]/g,"")),
				value2: filter.High.replace(/[*=<>]/g,""),
				tokenText: "!(=" + filter.Low + ")"				
			};
		};
		
		var setValuesToIntervalCtrls = function(){
			var intervals = [];
			that.intervals.forEach(function(inter){
				filtersArry.forEach(function(iter){
					if(iter.Property === inter.Key){
						intervals.push(iter);
					}				
				});
			});
			
			var ctrls = that.uiBuilderHelper.controlls;
			if(ctrls && ctrls.length > 0){
				ctrls.forEach(function(ctrl){
					var prop = ctrl.getAggregation("content")[0].getAggregation("content")[1].searchKey;
					var input = ctrl.getAggregation("content")[0].getAggregation("content")[1];
					if(prop){
						intervals.forEach(function(inter){
							if(inter.Property === prop){
								input.setValue(inter.Low + "-" + inter.High);
							}
						});
					}
				});
			}			
		};
		
		var jsonPayload = {};
		filtersArry.forEach(function(filter){
			if(filter.Option !== Constants.OPTION_CONST.eq()){
				if(jsonPayload[filter.Property] && Object.keys(jsonPayload[filter.Property]).length > 0 && jsonPayload[filter.Property].ranges && jsonPayload[filter.Property].ranges.length > 0){
					jsonPayload[filter.Property].ranges.push(rangeLikePayload(filter));
				}else{
					jsonPayload[filter.Property] = {};
					jsonPayload[filter.Property].ranges = [];
					jsonPayload[filter.Property].ranges.push(rangeLikePayload(filter));
				}
			}else if(filter.Option === Constants.OPTION_CONST.eq() && filter.Sign === Constants.SIGN_CONST.exclude()){
				if(jsonPayload[filter.Property] && Object.keys(jsonPayload[filter.Property]).length > 0 && jsonPayload[filter.Property].ranges && jsonPayload[filter.Property].ranges.length > 0){
					jsonPayload[filter.Property].ranges.push(rangeLikePayloadExclude(filter));
				}else{
					jsonPayload[filter.Property] = {};
					jsonPayload[filter.Property].ranges = [];
					jsonPayload[filter.Property].ranges.push(rangeLikePayloadExclude(filter));
				}
			}else{
				if(jsonPayload[filter.Property] && Object.keys(jsonPayload[filter.Property]).length > 0 && jsonPayload[filter.Property].items && jsonPayload[filter.Property].items.length > 0){
					jsonPayload[filter.Property].items.push(itemsLikePayload(filter));
				}else{
					jsonPayload[filter.Property] = {};
					jsonPayload[filter.Property].items = [];
					jsonPayload[filter.Property].items.push(itemsLikePayload(filter));
				}
			}
		});
				
		that.smartFilterBar.setFilterData(jsonPayload);
		
		//set interval like filters
		setValuesToIntervalCtrls();
	};
	
	DefineFilterHelper.prototype.generateFiltersManually = function(value,property){

		var isBetween = function(low,high,sign,property){
			return {
				"keyField": property,
				"exclude": false, 
				"operation": Constants.OPTION_CONST.bt(), 
				"value1": low, 
				"value2": high,
				"tokenText": ""};
		};
		
		var isEqual = function(low,high,sign,property){
			return {
				"keyField": property,
				"exclude": false, 
				"operation": Constants.OPTION_CONST.eq(), 
				"value1": low, 
				"value2": high,
				"tokenText": ""};
		};
		
		if(value.split("-").length > 0){
			return isBetween(value.split("-")[0],value.split("-")[1],Constants.SIGN_CONST.include(),property);
		}else{
			return isEqual(value,"",Constants.SIGN_CONST.include(),property);
		}
	};
	
	DefineFilterHelper.prototype.convertToOperation = function(option,low,high){
		
		var isEqual = function(){
			return Constants.OPTION_CONST.eq();
		};
		
		var isBetween = function(){
			return Constants.OPTION_CONST.bt();
		};
		
		var isContains = function(){
			if(low.charAt(0) === "*" && low.slice(-1) === "*"){
				return Constants.OPTION_CONST.contains();
			}else if(low.charAt(0) === "*"){
				return Constants.OPTION_CONST.endswith();
			}else if(low.slice(-1) === "*"){
				return Constants.OPTION_CONST.startswith();
			}
		};
		
		var isGreaterOrEqual = function(){
			return Constants.OPTION_CONST.ge();
		};
		
		var isGreater = function(){
			return Constants.OPTION_CONST.gt();
		};
		
		var isLesserOrEqual = function(){
			return Constants.OPTION_CONST.le();
		};
		
		var isLesser = function(){
			return Constants.OPTION_CONST.lt();
		};
		
		var options = {
		  	"EQ": isEqual,				    
		    "BT": isBetween,			   
		    "CP": isContains,
		    "GE": isGreaterOrEqual,
		    "GT": isGreater,
		    "LE": isLesserOrEqual,
		    "LT": isLesser
		  };
		  
		  return options[option]();
	};
	
	
	function isEqual(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign, 
			"Option": Constants.OPTION_CONST.eq(), 
			"Low": filter.low || undefined,
			"High": filter.high || undefined,
			"Text": filter.text === "" ? "" : filter.text
		};
	}
	
	function isContains(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.cp(), 
			"Low": "*" + ( filter.low || undefined ) + "*",
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isBetween(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign, 
			"Option": Constants.OPTION_CONST.bt(), 
			"Low": filter.low || undefined, 
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isEndsWith(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.ew(), 
			"Low": "*" + ( filter.low || undefined ),
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isStartsWith(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.sw(), 
			"Low": ( filter.low || undefined ) + "*",
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isGreaterOrEqual(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.ge(), 
			"Low": ">=" + ( filter.low || undefined ),
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isGreater(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.gt(), 
			"Low": ">" + ( filter.low || undefined ),
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	function isLesserOrEqual(filter){
		return {"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.le(), 
			"Low": "<=" + ( filter.low || undefined ),
			"High": filter.high || undefined,
			"Text": ""};
	};
	
	function isLesser(filter){
		return {
			"Id": undefined,
			"GroupId": undefined,
			"NodeId": filter.nodeID,
			"Property": filter.property,
			"Sign": filter.sign,
			"Option": Constants.OPTION_CONST.lt(), 
			"Low": "<" + ( filter.low || undefined),
			"High": filter.high || undefined,
			"Text": ""
		};
	}
	
	
	function filterItemFrom(filter){
		var options = {
			"BT": isBetween,
			"Contains": isContains,						
			"EndsWith": isEndsWith,
			"StartsWith": isStartsWith,
			"EQ": isEqual,
			"GE": isGreaterOrEqual,
			"GT": isGreater,
			"LE": isLesserOrEqual,
			"LT": isLesser
		};
		return options[filter.operation](filter);
	}
	
	
	function createFilterItem(property, nodeId){
		return function(filter){
			return filterItemFrom({
				operation:Constants.OPTION_CONST.eq(), 
				property: property, 
				sign: Constants.SIGN_CONST.include(),
				low: filter.key,
				high: "",
				nodeID: nodeId,
				text: filter.text
			});	
		};
	}
	
	
	function createRangeFilterItem(nodeId){
		return function(filter){
			return filterItemFrom({
				operation:filter.operation, 
				property: filter.keyField, 
				sign: filter.exclude ? "E" : "I",
				low: filter.value1,
				high: filter.value2,
				nodeID: nodeId,
				text: ""
			});
		};
	}
	
	DefineFilterHelper.prototype.createFilterForPayload = function(item,prop,id){
		if(item.items && item.items.length > 0){
			return item.items.map(createFilterItem(prop, id));
		}else if(item.ranges && item.ranges.length > 0){
			return item.ranges.map(createRangeFilterItem(id));
		} else {
			return [];
		}
	};
	
	DefineFilterHelper.prototype.updateFilters = function(newFiltersArry){
		var that = this;
		
		var newFilters = [];
		this.filters.forEach(function(filter){
			newFiltersArry.forEach(function(newFilter){
				if(filter.fieldName === newFilter){
					that.smartFilterBar.addFieldToAdvancedArea(filter.fieldName);
					newFilters.push(filter);
				}
			});			
		});
		
		var emptyGrid = this.uiBuilderHelper.redrawFilters(newFilters);
		this.dialog.addContent(this.uiBuilderHelper.getCtrlsForDialog(emptyGrid));
		this.uiBuilderHelper.destroyDialog();
	};
	DefineFilterHelper.prototype.calculateRadioSelection = function(){
		return this.uiBuilderHelper.getRadioSelection();
	};
	
	DefineFilterHelper.prototype.createPayload = function(){
		var calculatePayload = function(item,arry){	
			for(var iter in item.filters){
				arry.push(item.filters[iter]);
			}
			
			return arry;
		};
		
		var toReturn = [];
		for(var node in this.sfbFilters){
			calculatePayload(this.sfbFilters[node],toReturn);
		}
		
		return toReturn;
	};
	
	return DefineFilterHelper;
});