/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
//global Promise
sap.ui.define([
       		"jquery.sap.global",
    		"sap/m/Dialog",
    		"sap/m/Text",
    		"sap/m/Button",
    		"sap/ui/model/resource/ResourceModel",
    		"sap/ui/model/json/JSONModel",
    		"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    		"retail/pmr/promotionaloffers/utils/StatusHandler",	
    		"sap/ui/comp/filterbar/FilterItem",
    		"sap/m/MultiInput",
    		"retail/pmr/promotionaloffers/utils/ErrorHandler"
    	], 
    	function(jQuery, Dialog, Text, Button, ResourceModel, JSONModel, 
    			 ValueHelpDialog, StatusHandler,  FilterItem, MultiInput, ErrorHandler) {
	"use strict";
	
	function criticalError(i18nModel/*, messages*/){
		var messages = Array.prototype.slice.call(arguments, 1);
		ErrorHandler.showError(i18nModel.getResourceBundle().getText("CriticalErrors.ContactSysAdmin"));
		throw new Error(messages.join("\n"));
	}  
	function filter(properties){
		return function(value){
			var filters = properties.map(function(column){
				return new sap.ui.model.Filter(column, sap.ui.model.FilterOperator.Contains, value);
			});
			return new sap.ui.model.Filter({
				filters : filters,
				and : false
			});
		};
	}	
	function walk(tree, cb, parent){
		cb(tree, parent);
		for(var i in tree){
			if(tree.hasOwnProperty(i) && jQuery.isNumeric(i)){
				walk(tree[i], cb, tree);
			}
		}
	}
	
	function findInTree(tree, predicate){
		var result = [];
		walk(tree,function(item){
			if(predicate(item)){
				result.push(item);
			}
		},tree);
		return result;
	}

	function identity(x){
		return x;
	}
	function prop(name){
		return function(x){
			return x[name];
		};
	}	
	
	 function first(arr){
		if(!arr){
			return null;
		}
		return arr[0];
	}
	 
	function notNull(a) {
		/* eslint-disable */
		return a != null;
		/* eslint-enable */
	}	
	/**
	 * returns true if given value is a string with only zeros (but at least 5 zeros), the value 'AAAAAAAAAAAAAAAAAAAAAA==' or null
	 */
	var INITIAL_ZEROS_REGEX = new RegExp("^[0]{5,}$");
	function isInitial(value){
   		return value === null || value === undefined || value === "AAAAAAAAAAAAAAAAAAAAAA==" || value === "" || INITIAL_ZEROS_REGEX.test(value);
   	}
	function returnParentID(value){
		var toReturn = "AAAAAAAAAAAAAAAAAAAAAA==";
		
		if(INITIAL_ZEROS_REGEX.test(value)){
			return toReturn;
		}
		
		if(value === toReturn){
			return toReturn;
		}
		
		if(value === ""){
			return toReturn;
		}
		
		if(value === null){
			return toReturn;
		}
		
		return value;
	}
	function Item(Id, Title, SubTitle, ParentId, Info1, Info2){
		this.Id = Id;
		this.ParentId = ParentId;
		this.Title = Title;
		this.SubTitle = SubTitle;
		this.Info1 = Info1;
		this.Info2 = Info2;
		this.ExtHierarchyId = Info2;
	}
	Item.prototype.push = function(item){
		Array.prototype.push.call(this, item);
	};
	function buildMapOfIds(items){
		return items.reduce(function(result, currentItem){
			result[currentItem.Id] = new Item(currentItem.Id, 
											  currentItem.ExtNodeId, 
											  currentItem.Name, 
											  currentItem.ParentId,
											  currentItem.HierarchyDescription, 
											  currentItem.ExtHierarchyId);
			return result;
		}, {});
	}
	Item.buildTree = function(listOfGroups){
		var dictionary = buildMapOfIds(listOfGroups);
		return Object.keys(dictionary).reduce(function(roots, id){
			var item = dictionary[id];
			var parent = dictionary[item.ParentId] || roots;
			parent.push(item);
			return roots;
		}, []);
	};
	
	var _oFormatter = sap.ui.core.format.NumberFormat.getFloatInstance({
				  maxFractionDigits: 2,
				  groupingEnabled: true });
	
	var Utils = {

		getErrorHandler: function() {
			return ErrorHandler;	
		},
		setComponent: function (component) {
			this.component = component;
		},
		getComponent: function () {
			return this.component;
		},
		setupFeatures : function(features){
   			var i, l, key, value;
   			var result = {};
   			for(i = 0, l = features.length; i < l; i ++){
   				key = features[i].Key;
   				value = features[i].Value;
   				result[key] = value;
   			}
   			return result;
   		},
		buildTree : function(){
			return Item.buildTree.apply(Item, arguments);
		},		
		getFormatDatePiker: (function(){
			var oTimePicker = new sap.m.DatePicker();
			return function(time){
				if(!time) {
					return "";
				}
				return oTimePicker._formatValue(time);
			};
		}()),
		/**
		 * Checks if input is empty and sets the proper value state.
		 *
		 * @param {Object} oInput The input object.
		 * @returns {boolean} True if the input is empty, false otherwise.
		 */
		validateEmptyInputForm: function(oInput) {
			if(oInput.getValue().trim().length === 0) {
				oInput.setValueState(sap.ui.core.ValueState.Error);
				return true;
			}
			oInput.setValueState(sap.ui.core.ValueState.None);
			return false;
		},
		setResourceModel : function(resourceModel){
			this._i18nResourceModel = resourceModel;
		},
		getResourceModel: function(){
			return this._i18nResourceModel;
		},
		setReuseI18NModel : function (oController) {
			var resouceBundle = this.getI18NModel();
			oController.getView().setModel(resouceBundle, "i18n");
			return resouceBundle;
		},
		getI18NModel : function(){
			return this.getResourceModel();
		},
		getFormatedDateForSave: function(oDate){
			if (!oDate){
				return null;
			}
			if(!(oDate instanceof Date)) {
				return oDate;
			}
			var year = oDate.getFullYear();
			var month = this.pad(oDate.getMonth() + 1);
			var day = this.pad(oDate.getDate());
			var hours = this.pad(oDate.getHours());
			var minutes = this.pad(oDate.getMinutes());
			var seconds = this.pad(oDate.getSeconds());

			return [year, "-", month, "-", day, "T", hours, ":", minutes, ":", seconds].join("");
		},
		getFormatedStringDate: function(oDate){
			if (!oDate){
				return null;
			}
			if(!(oDate instanceof Date)) {
				return oDate;
			}
			var year = oDate.getFullYear();
			var month = this.pad(oDate.getMonth() + 1);
			var day = this.pad(oDate.getDate());
			var hours = this.pad(oDate.getHours());
			var minutes = this.pad(oDate.getMinutes());
			var seconds = this.pad(oDate.getSeconds());

			return [year, month, day, hours, minutes, seconds].join("");
		},
		getFormatedDateForRead: function(oDate){
		  	if (!oDate || !(oDate instanceof Date)) {
				return oDate;
		  	}
		  	return new Date(oDate.getTime() + oDate.getTimezoneOffset() * 60000);
	  	},
		pad: function(num, length){
			var numString = String(num);
		    var len = parseInt(length, 10) || 2;
		    while (numString.length < len) {
		    	numString = "0" + numString;
		    }
	    	return numString;
		},
		
		decodeFromBase64: function(oEncoded){
			return atob(oEncoded);
		},
		
		base64ToHex : function base64ToHex(str) {
			for (var i = 0, bin = this.decodeFromBase64(str.replace(/[ \r\n]+$/, "")), hex = []; i < bin.length; ++i) {
				var tmp = bin.charCodeAt(i).toString(16);
				if (tmp.length === 1) {
					tmp = "0" + tmp;
				}
				hex[hex.length] = tmp;
			}
			return hex.join("").toUpperCase();
		},
		
		base64ToGuid : function(sId) {
			var sHex = this.base64ToHex(sId);
			return sHex.slice(0,8) + "-" +
					sHex.slice(8,12) + "-" +
					sHex.slice(12,16) + "-" +
					sHex.slice(16,20) + "-" +
					sHex.slice(20);
		},
		dateMediumObj: sap.ui.core.format.DateFormat.getDateInstance({ style:"medium" }),
		dateShortObj:  sap.ui.core.format.DateFormat.getDateInstance({ style: "short" }),
		dateMedium: function(value) {
			return (value && value.getTime) ? this.dateMediumObj.format(value, false) : "";
		},
		getDateRange: function(from, to, utc) {	
			if (typeof from === "string") {
				// Create a javascript date for given date
				from = new Date(from.match(/\d+/)[0] * 1);
			}
			if (typeof to === "string") {
				// Create a javascript date for given date
				to = new Date(to.match(/\d+/)[0] * 1);
			}
			if (from && to && from.getTime && to.getTime) {
				return  this.dateShortObj.format(from, false) + " - " + this.dateShortObj.format(to, !!utc);
			}
			return "";
		},
		uiFilter : filter,
		liveChangeFilterHandler : function(properties, treeTableId){
			var filterFunction = filter(properties);
			return function(e){
				var view = this.getView().byId(treeTableId) || sap.ui.getCore().byId(treeTableId);
				var binding = view.getBinding("rows");
				var currentValue = e.getSource().getValue();

				if(currentValue.length >= 3){
					binding.filter([filterFunction(currentValue)]);
				}else{
					binding.filter(null);
				}
			};
		},
		getSizeLimit: function() {
			return 5000;
		},
		
		toOfferContent: function(sId, oConfig) {
			var sGuid = Utils.base64ToGuid(sId);
			var oTarget = {
   				semanticObject: oConfig.offerSemanticObject,
				action: oConfig.contentAction
   			};
   			
			var oService = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			if (oService) {
				var sUrl = oService.hrefForExternal( {target: oTarget});
				oService.toExternal({ 
						target : { shellHash : sUrl + "&/Offer/" + sGuid }
					});	
			}
		},
		
		promptUserForMasterDataSystemChange: function(newSystem, oldSystem) {
			var i18n = this.getI18NModel();
			return Utils.promptUser({
				i18n : i18n,
				title : "{i18n>CreateOffer.General.MasterDataSystemDialog.Title}",
				type: "Message",
				state: "Warning",
				text: "{i18n>CreateOffer.General.MasterDataSystemDialog.Message}" ,
				ok : "{i18n>CreateOffer.General.MasterDataSystem.Ok}",
				cancel : "{i18n>CreateOffer.General.MasterDataSystem.Cancel}",
				okValue : function(){
					return newSystem;
				},
				cancelValue : function(){
					return oldSystem;
				}
			});
		},	  
		promptUser: function(dialogOptions){
			dialogOptions.okValue = dialogOptions.okValue || jQuery.noop;
			dialogOptions.cancelValue = dialogOptions.cancelValue || jQuery.noop;
			return new Promise(function(resolve, reject){
				var dialog = new Dialog({
					title: dialogOptions.title,
					state : dialogOptions.state,
					type: dialogOptions.type,
					content: new Text({ text: dialogOptions.text}),
					beginButton: new Button({
						text: dialogOptions.ok,
						press: function () {
							dialog.close();
							resolve(dialogOptions.okValue());
						}
					}),
					endButton: new Button({
						text: dialogOptions.cancel,
						press: function () {
							dialog.close();
							reject(dialogOptions.cancelValue());
						}
					}),
					afterClose: function() {
						dialog.destroy();
					}
				});
				if(dialogOptions.i18n){
					dialog.setModel(dialogOptions.i18n, "i18n");
				}
				dialog.open();
			});
		},
		/**
		 * Removes duplicates from array of objects based on the provided property.
		 *
		 * @param {array} aArray The array of objets.
		 * @param {string} sProperty The property on which to find duplicated objects
		 * @returns {string} The array without duplicated object (with same value on sProperty).
		 */
		removeDuplicatedObjByProp: function(aArray, sProperty) {
			for (var i = 0; i < aArray.length; i++) {
				for (var j = i + 1; j < aArray.length; j++) {
					if (aArray[i][sProperty] === aArray[j][sProperty]) {
						aArray.splice(j, 1);
						j--;
					}
				}
			}
			return aArray;
		},
		handleErrors: function(oError) {
			ErrorHandler.handleError(oError);
		},
		
		setErrorMessages: function(oMessageManager, aMessages, oModel) {
			ErrorHandler.setErrorMessages(oMessageManager, aMessages, oModel);
		},
		
		setStatusField: function(value) {
			this.sStatusField = value;
			this.oStatusHandler = new StatusHandler(value);
		},
		
		getStatusField: function(value) {
			return this.sStatusField;
		},
		
		getStatusForSearch: function(value) {
			return this.oStatusHandler.getFieldForSearch(value);
		},
		
		status: function(iUIState, sStatus) {
			// XML is loaded before statusHandler was initialized
			if(!Utils.oStatusHandler) {
				Utils.oStatusHandler = new StatusHandler();
			}
			return Utils.oStatusHandler.getObjectStatusState({
				UIState: iUIState,
				Status: sStatus
			});
		},
		
		isReadOnly: function(value) {
			return this.oStatusHandler.getReadOnly(value);
		},
		
		isEditableHeader: function(value) {
			return this.oStatusHandler.getEditableHeader(value);
		},
		isStatusApprovedSaved: function(condition, value) {
			return condition && this.isReadOnly(value);
		},
		
		getStatusForStore: function(data){
			return this.oStatusHandler.getObjectForStore(data);
		},
		
		hasEntitySetProperty: function(sName, sSet, oMetaModel) {
			//Return true if entity set has property sName
			var sEntityType = oMetaModel.getODataEntitySet(sSet).entityType;
			var oEntityType = oMetaModel.getODataEntityType(sEntityType);
			return oEntityType.property.filter(function(p) { return p.name === sName;}).length === 1;
		},
		initOpenMasterDataSystemDialog: function(eventBus) {
			var oDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.MasterDataSystemDialog", {
				handleSearch: function() {
				},
				onCancelPress: function() {
					oDialog.destroy();
				},
				onMasterDataSystemSelect: function(oEvent) {
					var oSelectedItem = oEvent.getParameter("selectedItem").getBindingContext().getObject();
					eventBus.publish("retail.pmr.promotionaloffers", "onMasterDataSystemChange", {
						MasterdataSystemId : oSelectedItem.Id
					});
					oDialog.destroy();
				}
			});

			var i18nModel = this.getI18NModel();
			oDialog.setModel(i18nModel, "i18n");
			oDialog.setContentHeight("40%");

			// Getting master data systems and populating the dialog.
			/*global retail*/
			var Models = retail.pmr.promotionaloffers.utils.Models;
			Models.getMasterDataSystems().then(function(aSystems) {
				if(aSystems.length === 0){
					criticalError(i18nModel, "Missing Masterdata System", 
											 "Check that user can get a list of masterdata systems from backend.",
						  				     "Call '/MasterdataSystems' and check it has values");
				}
				Models.getMasterDataSystem().then(function(sMasterDataSystemToUse) {
					aSystems = aSystems.map(function(oItem) {
						oItem.Selected = false;
						if (oItem.Id === sMasterDataSystemToUse) {
							oItem.Selected = true;
						}
						return oItem; 
					});
					var oModel = new JSONModel(aSystems);
					oDialog.setModel(oModel);
					oDialog.open();
				});
			});
		},
		compose : (function(){
			function toArray(arrayLike){
				return Array.prototype.splice.call(arrayLike, 0);
			}

			function compose2(f,g){
				return function(x){
					return f(g(x));
				};
			}
			return function compose(/*...functions*/){
				return toArray(arguments).reduce(compose2, identity);
			};
		}()),
		getFieldsFromSort: function(sort) {
			var fields = [];
			if(!sort.length) {
				return fields;
			}
			
			for(var i = 0, iLen = sort.length; i < iLen; i++) {
				if(sort[i].sPath) {
					fields.push(sort[i].sPath);
				}
			}
			return fields;
		},
		attachFieldsToQuery : function attachFieldsToQuery(fields, query) {
	   		var aFields = query.split(",");
	   		return fields.reduce(function(query, currentField) {
				if (query.indexOf( currentField ) < 0) {
					query.push(currentField);
				}
				return query;
	        }, aFields).join(",");
	   	},
	   	flatenFilters: function(filterArry){
			var flatenedFilter = "";
			if(filterArry.length > 0){
				for(var z = 0, zLen = filterArry.length; z < zLen; z++){
					if(z === 0){
						flatenedFilter += filterArry[0];
					}else{
						flatenedFilter += " and " + filterArry[z];
					}
				}
			}

			return flatenedFilter;
		},
		getFilterString: function(filterArry, andOrStr){
			var query = "";
			var andOr = "";
			//and is exclude // or is include(logic for multiple filters)

			for(var z = 0, zLen = filterArry.length; z < zLen; z++){
				var filter = "";

				//andOr = filterArry[z].exclude ? "and " : "or ";
				andOr = andOrStr || " or ";

				if(z === 0){
					filter = this.getOption(filterArry[z]);
					if(zLen > 1){
						query += "(" + filter;
						if(!(z + 1 < zLen)){
							query += ")";
						}
					}else{
						query += filter;
					}

				}else{
					if(z + 1 < zLen){
						query += andOr + "" + this.getOption(filterArry[z]);
					}else{
						query += andOr + "" + this.getOption(filterArry[z]) + ")";
					}
				}
			}

			return query;
		},
		getArryByIncludeOrExclude: function(filterArry){

			var includeArry = [];
			var excludeArry = [];

			for(var q = 0, qLen = filterArry.length; q < qLen; q++){
				if(filterArry[q].exclude){
					excludeArry.push(filterArry[q]);
					continue;
				}
				includeArry.push(filterArry[q]);
			}

			var includeQuery = this.getFilterString(includeArry, " or ");
			var excludeQuery = this.getFilterString(excludeArry, " and ");

			var toReturn = "";
			if(includeQuery.length > 0 && excludeQuery.length > 0){
				toReturn = "(" + includeQuery + " and " + excludeQuery + ")";
			}else if(includeQuery.length > 0){
				toReturn = includeQuery;
			}else if(excludeQuery.length > 0){
				toReturn = excludeQuery;
			}

			return toReturn;
		},
		getOption: function(tokenValue){

			function returnSign(){
				return tokenValue.exclude === false ? "I" : "E";
			}

			function isEqual(){
				//exclude (equal)(LogSysId ne 'asd')
				//include (equal)(LogSysId eq 'asd')
				var query = tokenValue.exclude ? "(" + tokenValue.key + " ne '" + tokenValue.value1 + "')" : "(" + tokenValue.key + " eq '" + tokenValue.value1 + "')";

				return query;
			}

			function isContains(){
				//(substringof('a',LogSysId))
				var query = "(substringof('" + tokenValue.value1 + "'," + tokenValue.key + "))";

				return query;
			}

			function isBetween(){
				//((LogSysId ge 'a' and LogSysId le 'a'))
				var query = "((" + tokenValue.key + " ge '" + tokenValue.value1 + "' and " +
							tokenValue.key + " le '" + tokenValue.value2 + "'))";
				
				return query;
			}

			function isEndsWith(){
				//(endswith(LogSysId,'a'))
				var query = "(endswith(" + tokenValue.key + ",'" + tokenValue.value1 + "'))";

				return query;
			}

			function isStartsWith(){
				//(startswith(LogSysId,'a'))
				var query = "(startswith(" + tokenValue.key + ",'" + tokenValue.value1 + "'))";

				return query;
			}

			function isGe(){
				//(LogSysId ge 'a')
				var query = "(" + tokenValue.key + " ge '" + tokenValue.value1 + "')";

				return query;
			}

			function isGt(){
				//(LogSysId gt 'a')
				var query = "(" + tokenValue.key + " gt '" + tokenValue.value1 + "')";

				return query;
			}

			function isLe(){
				//(LogSysId le 'a')
				var query = "(" + tokenValue.key + " le '" + tokenValue.value1 + "')";

				return query;
			}

			function isLt(){
				//(LogSysId lt 'a')
				var query = "(" + tokenValue.key + " lt '" + tokenValue.value1 + "')";

				return query;
			}

		  var options = {
				  	"EQ": isEqual,
				    "Contains": isContains,
				    "BT": isBetween,
				    "EndsWith": isEndsWith,
				    "StartsWith": isStartsWith,
				    "GE": isGe,
				    "GT": isGt,
				    "LE": isLe,
				    "LT": isLt
				  };

		  return options[tokenValue.operator]();
		},
		identity: identity,
		get : function get(object, props){
			if(!object){
				return object;
			}
			var result = object[props[0]];
			if(props.length <= 1){
				return result;
			}
			var newProps = props.slice(1);
			return get(result, newProps);
		},
		getMessageManager:function () {
			return ErrorHandler.getMessageManager();
		},
		/**
		 * Removes message(s) from message manager based on a given path.
		 *
		 * @param {string} sPath The sPath.
		 * @param {sModelId} sModelId The model Id.
		 * @returns {void}
		 */
		removeMessagesByPath: function(sPath) {
			ErrorHandler.removeMessagesByPath(sPath);
		},
		
		removeMessagesByPatialPath: function(partialPath) {
			ErrorHandler.removeMessagesByPartialPath(partialPath);
		},
		
		errorMessagesExists: function() {
			return ErrorHandler.numOfMessages(this.getMessageManager()) > 0;
		},
		
		getFirstMessage: function() {
			return ErrorHandler.getFirstMessage(this.getMessageManager());
		},
		
	    errorExistByPatialPath: function(partialPath) {
	        var bError =  ErrorHandler.errorExistByPartialPath(partialPath);
			return bError;
		},

		getItemIndexInArray: function(id, array) {
			var index = -1;
			if (array && array.length > 0) {
				for (var i = 0; i < array.length; i++) {
					if (array[i].Id === id) {
						index = i;
						break;
					}
				}
			}
			return index;
		},
		
		createNewFilterFromHierarchyTokens: function(inputHierarchy) {
			var filterToReturn = null;
				var  filterDataFromTokens = this.getFiltersFromTokens([inputHierarchy],0);
				if (!filterDataFromTokens || (filterDataFromTokens && filterDataFromTokens.length < 1)) {
					return filterToReturn;
				}
				var allFilters = filterDataFromTokens.map(function(item) {
					var generateFilter = new sap.ui.model.Filter({	   		   				
	   		   			path: item.key,
		   		   	    operator: item.exclude ? "NE" : item.operator,
		   		   	    value1: "" + item.value1,
		   		   	    value2: "" + item.value2
			   			});
						
					return generateFilter;
				});
			
				filterToReturn = new sap.ui.model.Filter({
					filters: allFilters,
					and: false
				}); 
				return filterToReturn;
		},
			
		combineFilters: function(filters, and) {
			return new sap.ui.model.Filter({
				filters : filters,
				and : and
			});
		},
		
		createTokenForHierarchy: function(hierarchy) {
			var token = new sap.m.Token({text: hierarchy.Name || hierarchy.ExtId, key: hierarchy.Id});
			token.addCustomData(new sap.ui.core.CustomData({key: "HierarchyObject", value: hierarchy}));
			return token;
		},

		buildHierarchy: function(arry, type) {

		    var roots = [], children = {}, i = 0, len = 0;
		    for (i = 0, len = (arry || []).length; i < len; ++i) {

		    	var item = null;
		    	if(type === "LeadingCategory") {
		    		item = this.getItemByType("LeadingCategory",arry[i]);
				}

		    	if(type === "Location") {
		    		item = this.getItemByType("Location",arry[i]);
				}
				
		    	if(!type){
		    		item = arry[i];
		    		
	    			var p = item.virtualParentId;
		            if(this.isInitial(p)) {
		            	p = null;
					}
					
		            var target = !p ? roots : (children[p] || (children[p] = []));
		            target.push(item);			    	
		    	}else{
		    		if(item){
			    		var p = item.ParentId;
			            if(this.isInitial(p)) {
			            	p = null;
						}
						
			            var target = !p ? roots : (children[p] || (children[p] = []));
			            target.push(item);
			    	}
		    	}
		    }

		    if(type === "LeadingCategory"){
		    	for (i = 0, len = (arry || []).length; i < len; ++i) {
			        this.findChildrenForLeadingCategory(roots[i],children);
			    }
		    }

		    if(type === "Location"){
		    	for (i = 0, len = arry.length; i < len; ++i) {
			        this.findChildrenForLocation(roots[i], children);
			    }
		    }
		    
		    if(!type){
		    	for (i = 0, len = arry.length; i < len; ++i) {
			        this.findChildrenForLeadingCategory(roots[i],children);
			    }
		    }

		    return roots;
		},
		getItemByType: function(type, data){
			var item = {};
			
			if(type === "LeadingCategory"){
				item =  {"ExtHierarchyId":data.ExtHierarchyId,
	        			"ExtId": data.ExtId,
	        			"HierarchyDescription": data.HierarchyDescription,
	        			"HierarchyId": data.HierarchyId,
	        			"Id": data.Id,
	        			"MasterdataSystem": data.MasterdataSystem,
	        			"Name": data.Name,
	        			"ParentId": data.ParentId
				};

				return item;
			}

			if(type === "Location"){

				var locationsArry = data.Locations.results.filter(function(item){
					delete item.__metadata;

					return true;
				});
				data.Locations.results = locationsArry;

				item =  {"ExtHierarchyId":data.ExtHierarchyId,
	        			"ExtNodeId": data.ExtNodeId,
	        			"HierarchyDescription": data.HierarchyDescription,
	        			"HierarchyId": data.HierarchyId,
	        			"LogSysId": data.LogSysId,
	        			"NodeId": data.NodeId,
	        			"MasterdataSystem": data.MasterdataSystem,
	        			"NodeType": data.NodeType,
	        			"ParentId": data.ParentId,
	        			"HierarchyCombination": data.HierarchyCombination,
	        			"Location" : data.Locations.results
				};

				return item;
			}
		},
		findChildrenForLeadingCategory: function(parent,children){
			if(parent){
	    		if (children[parent.Id]) {
		            parent.children = children[parent.Id];
		            for (var i = 0, len = parent.children.length; i < len; ++i) {
		                this.findChildrenForLeadingCategory(parent.children[i],children);
		            }
		        }
	    	}
		},
		findChildrenForLocation: function(parent,children){
			if(parent){
	    		if (children[parent.NodeId]) {
		            parent.children = children[parent.NodeId];
		            for (var i = 0, len = parent.children.length; i < len; ++i) {
		                this.findChildrenForLocation(parent.children[i],children);
		            }
		        }
	    	}
		},		
		addMasterdataSystemButton: function(oEventBus) {
			var oMdSystemBtn = new sap.m.Button({
   				text: this.getResourceModel().getProperty("CreateOffer.MasterDataSystem"),   				
   				press: jQuery.proxy(function() {
   					this.initOpenMasterDataSystemDialog(oEventBus);
   				}, this)
   			});
   			sap.ushell.services.AppConfiguration.addApplicationSettingsButtons([oMdSystemBtn]);
		},		
		messageChangeEvent: function(oEvent){
        	var newMessages = oEvent.getParameter("newMessages");
        	var oldMessages = oEvent.getParameter("oldMessages");
			if(!newMessages.length) {
				return;
			}
			var messageManager = sap.ui.getCore().getMessageManager();
		
			for(var i = 0, iLen = newMessages.length; i < iLen; i++) {
				newMessages[i].persistent = true;
			}
			
			if(newMessages.length) {
				var messages = this.removeDuplicatedObjByProp(messageManager.getMessageModel().oData, "message");
				messageManager.removeAllMessages();
				messageManager.addMessages(messages);
			}			
        },
		openDeleteConfirmDiaog: function(bSingle, dialogProperties) {
			return new Promise(function(resolve, reject) {
				
				var oBundle = this.getResourceModel().getResourceBundle();
				
				var message = "";
				if (bSingle) {
					message = oBundle.getText(dialogProperties ? dialogProperties.massageSingle : "ManageOffers.DeleteSingleOfferDialog.Message");
				} else {
					message = oBundle.getText(dialogProperties ? dialogProperties.messageMulti : "ManageOffers.DeleteOfferDialog.Message");
				}
				
				var sConfirmLabel = "ManageOffers.DeleteOfferDialog.Ok";
				if (dialogProperties && dialogProperties.confirmLabel && dialogProperties.confirmLabel !== "") {
					sConfirmLabel = dialogProperties.confirmLabel;
				}
				
				var oDialog = new Dialog({
					title: oBundle.getText(dialogProperties ? dialogProperties.title : "ManageOffers.DeleteOfferDialog.Title"),
					type: "Message",
					state: "Warning",
					content: new Text({
						text: message
					}),
					beginButton: new Button({
						text: oBundle.getText(sConfirmLabel),
						press: function () {
							oDialog.close();
							resolve();
						}
					}),
					endButton: new Button({
						text: oBundle.getText("ManageOffers.DeleteOfferDialog.Cancel"),
						press: function () {
							oDialog.close();
							reject();
						}
					}),
					afterClose: function() {
						oDialog.destroy();
					}
	
				});
				oDialog.open();
			}.bind(this));
		},
		navToEditOffer: function(oRouter, oOffer, noHistory){
			
			var notEditable = oOffer.Editable === false;
			var hasBadStatus = Utils.isReadOnly({State: oOffer.State, UIState: oOffer.UIState});
			
			if (notEditable || hasBadStatus) {
				var text = this.getResourceModel().getResourceBundle().getText("ManageOffers.offerNotEditable");
				if(hasBadStatus){
					text = jQuery.sap.formatMessage(this.getResourceModel().getResourceBundle().getText("ManageOffers.offerNotEditableStatus"), oOffer.StatusName);
				}
				Utils.getErrorHandler().showError(text);
			} else {
				oRouter.navTo("edit", {
					path : this.base64ToHex(oOffer.OfferId)
				}, !!noHistory);
			}
		},		
		navTocopyOffer: function(oRouter, oOffer){
   			oRouter.navTo("copy", {
   				path :  this.base64ToHex(oOffer.OfferId)
   			});
   		},

		isInitial : isInitial,
		returnParentID: returnParentID,
		
		throttle : function throttle(fn, threshhold, scope) {
			threshhold = threshhold || 250;
			var last = null, 
				deferTimer = null;
			return function () {
				var context = scope || this,
					now = + new Date(),
					args = arguments;
				
				if (last && now < last + threshhold) {
					clearTimeout(deferTimer);
					deferTimer = setTimeout(function () {
						last = now;
						fn.apply(context, args);
					}, threshhold);
				} else {
			    	last = now;
			    	fn.apply(context, args);
			    }
			};
		},
		getFiltersFromTokens: function(searchFilters, index){
			var toReturn = [];
			for(var tokenIndex = 0, tokensLen = searchFilters[index].getTokens().length; tokenIndex < tokensLen; tokenIndex++){
				var cItem = {};
				if(searchFilters[index].getTokens()[tokenIndex].getAggregation("customData").length > 0){
					var tokenValue = searchFilters[index].getTokens()[tokenIndex].getAggregation("customData")[0].getProperty("value");
					cItem.key = tokenValue.keyField;
					cItem.exclude = tokenValue.exclude;
					cItem.operator = tokenValue.operation;
					cItem.value1 = tokenValue.value1;
					cItem.value2 = tokenValue.value2;

				}else{
					cItem.key = searchFilters[index].searchKey;
					cItem.operator = "EQ";
					cItem.exclude = false;
					cItem.value1 = searchFilters[index].getTokens()[tokenIndex].getKey();
					cItem.value2 = "";
				}
				
				toReturn.push(cItem);
			}
			
			return toReturn;
		},
		calculateFilters: function(o){
			var filters = [];
			var searchFilters = o.getParameters().selectionSet || [];
			for(var index = 0, filtersLen = searchFilters.length; index < filtersLen; index++){

				if(searchFilters[index].getValue().length > 0){
					var nItem = {};
					nItem.key = searchFilters[index].searchKey;
					nItem.exclude = false;
					var filterValue = searchFilters[index].getValue() || "";
					nItem.value1 = filterValue.toUpperCase();
					nItem.value2 = "";
					if(nItem.key === "ExtNodeId"){
						nItem.operator = "Contains";
						filters.push(this.getOption(nItem));
						continue;
					}
					nItem.operator = "EQ";

					var filterFromTokens = [];
					filterFromTokens.push(nItem);
					
					if(searchFilters[index].getTokens().length > 0){
						filterFromTokens = this.getFiltersFromTokens(searchFilters,index);
					}
				}else{
					filterFromTokens = this.getFiltersFromTokens(searchFilters,index);
				}

				if(filterFromTokens.length > 0){
					var resu = this.getArryByIncludeOrExclude(filterFromTokens);
					filters.push(resu);
				}
			}
			
			return filters;
		},
		setBasicSearchValue: function(nameOfDialog){
			var basicSearchID = this[nameOfDialog].getFilterBar().getBasicSearch();
			var basicInput = jQuery("#" + basicSearchID + " input");
			var basicSearchValue = basicInput.length > 0 ? basicInput.val() : "";
			
			return basicSearchValue;
		},
		/**
		 * Gets the week for the given date.
		 *
		 * @param {object} oDate The date for which to search the week.
		 * @returns {void}
		 */
		getWeek: function(oDate) {
			// Correct Date for timezone before converting
			var correctedDate = this.subTimezoneOffset(oDate);
			var Models = retail.pmr.promotionaloffers.utils.Models;
			return Models.getWeeks().then(function(aWeeks) {
				for (var i = 0; i < aWeeks.length; i++) {
					if (correctedDate >= aWeeks[i].Start.getTime() && correctedDate <= aWeeks[i].End.getTime()) {
						return aWeeks[i].Description;
					}
				}
				return Promise.reject();
			});
		},		
		/**
		 * Adds the timezone offset to a given date only if it is of type date.
		 * 
		 * @param {object} oDate The value (date) to wich must be added the timezone offset.
		 * @returns {object} A new date from the given date to wich was added the timezone offset.
		 */
		addTimezoneOffset: function(oDate) {
			if (!(oDate instanceof Date)) {
				return oDate;
			}
			return new Date(oDate.getTime() + oDate.getTimezoneOffset() * 60000);
		},		
				
		/**
		 * Subtracts the timezone offset to a given date only if it is of type date.
		 * 
		 * @param {object} oDate The value (date) to wich must be subtracted the timezone offset.
		 * @returns {object} A new date from the given date to wich was subtracted the timezone offset.
		 */
		subTimezoneOffset: function(oDate) {
			if (!(oDate instanceof Date)) {
				return oDate;
			}
			return new Date(oDate.getTime() - oDate.getTimezoneOffset() * 60000);
		},		
				
		createDialogUtil: function(options){
	   		return new Promise(function(resolve, reject){
	   			var dialog = new sap.m.Dialog({
	   				title: options.title,
	   				type: options.type || "Message",
	   				state: options.state || "None",
	   				content: new sap.m.Text({ text: options.message}),
	   				beginButton: new sap.m.Button({
	   					text: options.btnOk,
	   					press: function () {
	   						dialog.close();
	   						options.onOk(resolve, reject);
	   					}
	   				}),

	   				endButton: options.btnCancel && new sap.m.Button({
	   					text: options.btnCancel,
	   					press: function () {
	   						dialog.close();
	   						options.onCancel(resolve, reject);
	   					}
	   				}),
	   				afterClose: function() {
	   					dialog.destroy();
	   				}
	   			});
	   			options.view.addDependent(dialog);
	   			dialog.open();
	   		});
	   	},
	   	
	   	offerContentSaveDialog: function(view) {
			return this.createDialogUtil({
				title: "{i18n>Offer.OfferContent}",
				btnOk : "{i18n>Offer.OK}",
				btnCancel : "{i18n>CreateOffer.General.CancelBtn}",
				message : "{i18n>Offer.OfferContentSave}",
				state : "Warning",
				view : view,
				onOk : function(resolve){
					resolve();
				},
				onCancel : function(resolve, reject) {
					reject();
		   		}
			});
		},
		
		manageVersionsSaveDialog: function(view) {
			return this.createDialogUtil({
				title: "{i18n>ManageVersions.Title}",
				btnOk : "{i18n>Offer.OK}",
				btnCancel : "{i18n>CreateOffer.General.CancelBtn}",
				message : "{i18n>Offer.OfferContentSave}",
				state : "Warning",
				view : view,
				onOk : function(resolve){
					resolve();
				},
				onCancel : function(resolve, reject) {
					reject();
		   		}
			});
		},
		
	   	guid: function(){
	   		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
	   		    var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
	   		    return v.toString(16);
	   		});
	   	},
	   	filterData: function(locationsSet){
			var treeData = [];
			for(var i = 0, locCatLen = locationsSet.length; i < locCatLen; i++){
				
				var locations = locationsSet[i].Locations.results || locationsSet[i].Locations;
				for(var j = 0, jLen = locations.length; j < jLen; j++){
					locationsSet[i][j] = this.clear(locations[j]);
				}
				
				treeData.push(this.deleteMetadataLocations(locationsSet[i]));
			}
			
			return treeData;
		},
		clear: function(toReturn) {
			Object.getOwnPropertyNames(toReturn).forEach(function(name){
				if(jQuery.type(toReturn[name]) === "object") {
					delete toReturn[name];
				}
			});
			
			var aFields = ["NodeId", "HierarchyId", "LocationId", "ExtNodeId", 
						"City", "Region", "RegionName", "Country", "CountryName"];
			aFields.forEach(function(sField) { toReturn[sField] = toReturn[sField] || ""; });
			
			toReturn.ParentId = toReturn.ParentNodeId || toReturn.ParentId;
			toReturn.checked = toReturn.checked ? toReturn.checked : false;
			
			if (jQuery.isNumeric(toReturn.BlockingEndDate)) {
				toReturn.BlockingEndDate = toReturn.BlockingEndDate;
			} else {
				toReturn.BlockingEndDate = toReturn.BlockingEndDate ? toReturn.BlockingEndDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(toReturn.BlockingStartDate)) {
				toReturn.BlockingStartDate = toReturn.BlockingStartDate;
			} else {
				toReturn.BlockingStartDate = toReturn.BlockingStartDate ? toReturn.BlockingStartDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(toReturn.ClosingDate)) {
				toReturn.ClosingDate = toReturn.ClosingDate;
			} else {
				toReturn.ClosingDate = toReturn.ClosingDate ? toReturn.ClosingDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(toReturn.OpeningDate)){
				toReturn.OpeningDate = toReturn.OpeningDate;
			} else {
				toReturn.OpeningDate = toReturn.OpeningDate ? toReturn.OpeningDate.getTime() : null;
			}
			return toReturn;
		},
		removeMetadata: function(o){								
			var toReturn = {};
			
			var aFields = ["NodeId", "HierarchyId", "LocationId", "ExtNodeId", "Name",
						"ExtLocationId", "DistributionChannelDescription", "DistributionChannel",
						"SalesOrgDescription", "SalesOrg", "PurchaseOrgDescription", "PurchaseOrg",
						"City", "Region", "RegionName", "Country", "CountryName"];
			aFields.forEach(function(sField) { toReturn[sField] = o[sField] || ""; });
			
			toReturn.ParentId = o.ParentNodeId || o.ParentId;
			toReturn.checked = o.checked ? o.checked : false;
			toReturn.HierarchyDescription = o.HierarchyDescription;
			toReturn.HierarchyId = o.HierarchyId;
			toReturn.expanding = toReturn.expanding ? toReturn.expanding : false;
			
			if (jQuery.isNumeric(o.BlockingEndDate)) {
				toReturn.BlockingEndDate = o.BlockingEndDate;
			} else {
				toReturn.BlockingEndDate = o.BlockingEndDate ? o.BlockingEndDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(o.BlockingStartDate)) {
				toReturn.BlockingStartDate = o.BlockingStartDate;
			} else {
				toReturn.BlockingStartDate = o.BlockingStartDate ? o.BlockingStartDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(o.ClosingDate)) {
				toReturn.ClosingDate = o.ClosingDate;
			} else {
				toReturn.ClosingDate = o.ClosingDate ? o.ClosingDate.getTime() : null;
			}
			
			if (jQuery.isNumeric(o.OpeningDate)){
				toReturn.OpeningDate = o.OpeningDate;
			} else {
				toReturn.OpeningDate = o.OpeningDate ? o.OpeningDate.getTime() : null;
			}
			
			return toReturn;								
		},
		deleteMetadataLocations: function(o){
			
			delete o.Locations;
			delete o.__metadata;
			
			var copy = jQuery.extend({}, o);
			var parentID = this.returnParentID(copy.ParentId);
			
			copy.checked = o.checked ? o.checked : false;
			copy.expanding = o.expanding ? o.expanding : false;
			copy.ParentId = parentID;
			
			return copy;
		},
		buildHierarchyVH: function(arry) {
		    var roots = [], children = {};
		    for (var i = 0, len = arry.length; i < len; ++i) {		    	
	    		
		    	var p = arry[i].ParentId;
	            if(this.isInitial(p)) {
	            	p = null;
				}
				
	            var target = !p ? roots : (children[p] || (children[p] = []));
	            target.push(arry[i]);		    
		    }

	    	for (var j = 0, jLen = arry.length; j < jLen; ++j) {
		        this.findChildren(roots[j], children);
		    }
	
		    return roots;
		},	
		buildLocationHierarchyFromVH: function(object) {
			var locationHierarchy = [];
			var buildLocationHierarchy = function(object) {
				var item = {"Locations" : []};
				for (var key in object) {
					if(object.hasOwnProperty(key) && jQuery.isNumeric(key)){
						var childObject = object[key];
						if (childObject.userCreatedNode === true) {
							continue;
						}
						if (childObject.NodeId === "") {
							item.Locations.push(childObject);
						} else {
							buildLocationHierarchy(childObject);
						}
					} else {
						item[key] = object[key];
					}
				}
				locationHierarchy.push(item);
			};
			buildLocationHierarchy(object);
			return locationHierarchy;
		},
		findChildren: function(parent,children){
			if(parent){
	    		if (children[parent.NodeId]) {
				var pLen = this.calculateLength(parent);
				var cLen = children[parent.NodeId].length;
		            for(var j = 0; j < cLen; j++) {
		            	parent[pLen + j] = children[parent.NodeId][j];
		            }
		            
		            for (var i in parent) {
		    			if(parent.hasOwnProperty(i) && jQuery.isNumeric(i)){
		    				this.findChildren(parent[i],children);
		    			}	                
		            }	
	            }	            
			}	    	
		},
		calculateLength: function(item){
			var count = 0;
			for(var i in item){
				if(item.hasOwnProperty(i) && jQuery.isNumeric(i)){
					count++;
				}
			}
			
			return count;
		},
		getNodeType: function(item,_nameOfId,_nameOfType){
			var type = item.NodeId ? "04" : "01";
			var id = item.NodeId || item.LocationId;
			
			var toReturn = {};
			toReturn[_nameOfId] = id;
			toReturn[_nameOfType] = type;
			
			return toReturn;
		},
		flattenTree: function(items,tree){
			if(tree.length > 0){
				for(var i = 0, iLen = tree.length; i < iLen; i++){
					items.push(this.removeMetadata(tree[i]));
					this.pushChildrens(tree[i],items);					
				}
			}else{
				this.pushChildrens(tree,items);
			}							
		},
   		pushChildrens: function(arry,items){
			for(var j in arry){
				if(arry.hasOwnProperty(j) && jQuery.isNumeric(j))
				{
					items.push(this.removeMetadata(arry[j]));
					this.flattenTree(items,arry[j]);
				}
			}
		},
		isAllDay: function(startOfOffer, endOfOffer) {
			var start = new Date(startOfOffer);
			var end =  new Date(endOfOffer);
			start.setHours(0, 0, 0, 0);
			end.setHours(23, 59, 59, 0);
			return start.getTime() === startOfOffer.getTime() && end.getTime() === endOfOffer.getTime();
			
		},
		addValidationMessages: function(message,path,model){
			var validationPresent = false;
			if(message.message){
				var oMessageManager = this.getMessageManager();			
				var aMessages = [{
					message: message.message,
					description: message.description,
					type: "Error",
					target: path,
					processor: model
				}];
				
				this.removeMessagesByPath(path);
				this.setErrorMessages(oMessageManager, aMessages);
				validationPresent = true;
			}else{
				this.removeMessagesByPath(path);
				validationPresent = false;
			}	
			
			return validationPresent;
		},
		isGreaterOrEqual: function(min,value){
			var numValue = parseFloat(value);
			
			if(this.isNumeric(value)){
				if(numValue >= min){
					return true;
				}else if(isNaN(numValue)){
					return true;
				}
				
				return false;
			}
			
			return false;
		},
		isPositive: function(value){
			var numValue = parseFloat(value.replace(',','.'));
			
			if(this.isNumeric(value)){
				if(numValue > 0){
					return true;
				}else if(isNaN(numValue)){
					return true;
				}
				
				return false;
			}
			
			return false;
		},
		isNumeric: function(value){
			var numValue = parseFloat(value);
			
			if(typeof numValue === "number" && isFinite(numValue) ){
				return true;
			}else if(typeof value === "string" && value === ""){
				return true;
			}
			
			return false;
		},
		isFilled: function(value){
			if(value !== "" && value.trim() !== ""){
				return true;
			}
				
			return false;
		},
		isInRange: function(min,max,value){
			var numValue = parseFloat(value);
			
			if(this.isNumeric(value)){
				if(numValue >= min && numValue <= max){
					return true;
				}else if(isNaN(numValue)){
					return true;
				}
				
				return false;
			}
			
			return false;
		},
		validationHandler: function(param,oEvent,path,data,mdl){
			var min = 0;
			var max = 100;
			var i18n = this.getI18NModel().getResourceBundle();
			var message = {};
			var sPath = oEvent.getSource().getBindingContext() ? oEvent.getSource().getBindingContext().sPath + path : path;
			var that = this;
			var model = mdl;
			var index = oEvent.getSource().getBindingContext() ? oEvent.getSource().getBindingContext().sPath.split("/")[2] : -1;
			var validationPresent = false;
			
			var minDiscountValidation = function(){			
				var reward = data.Rewards[index];
				
				if(reward && reward.Selection.DiscountType === "04"){
					rangeValidation(min,max,oEvent,path);
				}else{
					greaterOrEqualValidation(oEvent,min,path);
				}
			};
			
			var minDiscountProductDetails = function(){
				var detail = data.ProductDetails[index];
				
				if(detail && detail.DiscountType === "04"){
					rangeValidation(min,max,oEvent,path);
				}else{
					greaterOrEqualValidation(oEvent,min,path);
				}
			};
		
			var minAmountValidation = function(){
				var term = data.Terms[index];
				
				if(term && term.Selection.DimensionType === "20"){
					numericValidation(oEvent,path);
				}else{
					greaterOrEqualValidation(oEvent,min,path);
				}
			};
			
			var rangeValidation = function(){
				if( !that.isNumeric(oEvent.getParameters().value) ){				
					message = {message : i18n.getText("Validation.Terms.Is.Numeric.Title"), description: i18n.getText("Validation.Terms.Is.Numeric")};
				}else if( !that.isInRange(min,max,oEvent.getParameters().value) ){				
					message = {
						message : jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Not.In.Range.Title"), "" + min,"" + max), 
						description: jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Not.In.Range"), "" + min,"" + max) 
					};
				}
				
				validationPresent = that.addValidationMessages(message,sPath,model);
			};
			
			var greaterOrEqualValidation = function(){
				if( !that.isNumeric(oEvent.getParameters().value) ){				
					message = {message : i18n.getText("Validation.Terms.Is.Numeric.Title"), description: i18n.getText("Validation.Terms.Is.Numeric")};
				}else if( !that.isGreaterOrEqual(min,oEvent.getParameters().value) ){				
					message = {
						message : jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Greater.Or.Equal.Title"), "" + min), 
						description: jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Greater.Or.Equal"), "" + min) 
					};
				}
				
				validationPresent = that.addValidationMessages(message,sPath,model);
			};
			
			var greaterOrEqualValidationWithMax = function(){
				if( !that.isNumeric(oEvent.getParameters().value) ){
					message = {message : i18n.getText("Validation.Terms.Is.Numeric.Title"), description: i18n.getText("Validation.Terms.Is.Numeric")};
				}else if( !that.isInRange(min, 10000000, oEvent.getParameters().value) ){				
					message = {
						message : jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Not.In.Range.Title"), "" + min, "9999999"), 
						description: jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Not.In.Range"), "" + min, "9999999") 
					};
				}
				
				validationPresent = that.addValidationMessages(message,sPath,model);
			};
			
			var numericValidation = function(){
				if( !that.isNumeric(oEvent.getParameters().value) ){				
					message = {message : i18n.getText("Validation.Terms.Is.Numeric.Title"), description: i18n.getText("Validation.Terms.Is.Numeric")};
				}else if( !that.isPositive(oEvent.getParameters().value) ){
					message = {
						message : i18n.getText("Validation.Terms.Is.Numeric.And.Positive.Title"), 
						description: jQuery.sap.formatMessage(i18n.getText("Validation.Terms.Is.Numeric.And.Positive"), "" + min) 
					};
				}
				
				validationPresent = that.addValidationMessages(message,sPath,model);
			};
			
			var emptyValidation = function(){
				if( !that.isFilled(oEvent.getParameters().value) ){
					message = {
						message : i18n.getText("Validation.Terms.Not.Epmty.Title"), 
						description: i18n.getText("Validation.Terms.Not.Epmty") 
					};
				}
				
				validationPresent = that.addValidationMessages(message,sPath,model);
			};
			
			var option = {
			  	"emptyValidation": emptyValidation,
			    "numericValidation": numericValidation,
			    "greaterOrEqualValidation": greaterOrEqualValidation,
			    "rangeValidation": rangeValidation,
			    "minAmountValidation":minAmountValidation,
			    "minDiscountValidation":minDiscountValidation,
			    "minDiscountProductDetails" : minDiscountProductDetails,
			    "greaterOrEqualValidationWithMax" : greaterOrEqualValidationWithMax
			};
			
			option[param]();
			
			return validationPresent;
		},
		isClosed: function(item,validityStart,validityEnd){
			
			var openingDate = item.OpeningDate ? item.OpeningDate : null;
			var closingDate = item.ClosingDate ? item.ClosingDate : null;
			var blockingEndDate = item.BlockingEndDate ? item.BlockingEndDate : null;
			var blockingStartDate = item.BlockingStartDate ? item.BlockingStartDate : null;
			var offerStart = validityStart ? validityStart : null;
			var offerEnd =  validityEnd ? validityEnd : null;
			
			if(openingDate && offerEnd < openingDate){
				return true;
			}else if(closingDate && closingDate < offerStart){
				return true;
			}else if(!!(blockingEndDate && blockingStartDate) && (blockingStartDate < offerStart && offerEnd < blockingEndDate)){
				return true;
			}
			
			return false;
		},
		isInOfferRange: function(version,validityStart,validityEnd, mainOffer){
			
			var versionStartDate = version.StartOfOffer;
			var versionEndDate = version.EndOfOffer;
			if (mainOffer && versionStartDate.getTime() === mainOffer.StartOfOffer.getTime() && versionEndDate.getTime() === mainOffer.EndOfOffer.getTime()) {
				return true;
			}
			if(versionStartDate.getTime() < validityStart.getTime()){
				return false;
			}else if(validityEnd.getTime() < versionEndDate.getTime()){
				return false;
			}
			
			return true;
		},		
		isNotOnExcluded: function(version, localNodes, excluded) {
			var locationId = version.LocationId || version.LocationNodeId || version.ExtLocationNodeId;
			for (var i = 0; i < excluded.length; i++) {
				var excludedLocationId = excluded[i].NodeId || excluded[i].LocationId;
				if (locationId === excludedLocationId 
						|| this.isExcludedStoreFromUserNode(locationId, excludedLocationId, localNodes)){
					return false;
				}
			}	
			return true;
		},		
		isExcludedStoreFromUserNode: function(ExtLocationNodeId, excludedLocationId, localNodes) {
			if (!localNodes) {
				return false;
			}
			var isExcludedChildrens = function(LocationId, childrens) {
				for (var i = 0; i < childrens.length; i++) {
					if (childrens[i].NodeId === LocationId) {
						childrens.splice(i, 1);
						if (childrens.length === 0) {
							return true;
						}				
					}
				}
				return false;
			};
			
			for (var i = 0; i < localNodes.length; i++) {
				var childrens = localNodes[i].Children || [];
				if ((localNodes[i].Description === ExtLocationNodeId 
						|| localNodes[i].Id === ExtLocationNodeId) 
						&& isExcludedChildrens(excludedLocationId, childrens)) {
					return true;	
				}
			}
			return false;
		},
		getTextLikeToken: function(low,high,sign,option){
			function isEqual(){
				return "=" + low;
			}
			
			function isEqualExclude()
			{
				return "!(=" + low + ")";
			}

			function isBt(){
				return low + "-" + high; 
			}
			
			function returnLow(){
				return low;
			}
			
			var options = sign.toUpperCase() === "I" ? {
				  	"EQ": isEqual,				    
				    "BT": isBt,
				    "EndsWith": returnLow,
				    "StartsWith": returnLow,
				    "CP": returnLow,
				    "LE": returnLow,
				    "LT": returnLow,
				    "GE": returnLow,
				    "GT": returnLow
				  } : {"EQ": isEqualExclude};
				  
		  return options[option]();
		},
		cleanFinancialsForVersion: function(version, removeOnlyEmptyIncentives) {
			if (version && version.Terms) {
				version.Terms.forEach(function(term) {
					if (!removeOnlyEmptyIncentives) {
						term.Financials = { Id: ""};
						this.cleanProductsFinancials(term.TermProducts);
					}		
					if (term.Incentives && term.Incentives.length === 0) {
							delete term.Incentives;
					}
					
				}.bind(this));
			}	
			delete version.Financials;
			delete version.Readonly;
			delete version.ShowEdit;
		},
		cleanProductsFinancials: function(products) {
			if (products) {
				products.forEach(function(product) {
					delete product.Financials;
					product.Financials = {Id: ""};
				});
			}	
		},		
		not: function(pred){
			return function(x){
				return !pred(x);
			};
		},
		allEqual: function(array){
			var item = array[0];
			for(var i = 1; i < array.length; i++){
				if(item !== array[i]){
					return false;
				}
			}
			return true;
		},
		concatAll: function(arrays){
			return Array.prototype.concat.apply([], arrays).filter(function(x){
				return x !== undefined && x !== null;
			});
		},
		takeWhile: function(pred, xs){
			var result = [];
			for(var i = 0; i < xs.length; i++){
				if(!pred(xs[i])){
					break;
				}
				result.push(xs[i]);
			}
			return result;
		},
		find: function(pred, xs, defaultValue){
			for(var i = 0; i < xs.length; i++){
				if(pred(xs[i])){
					return xs[i];
				}
			}
			return defaultValue;
		},
		unique: function(xs){
			return xs.filter(function(item, i, all){
				return all.indexOf(item) === i;
			});
		},
		criticalError : criticalError,
		prop : prop,
		walk : walk,
		findInTree : findInTree,
		notNull : notNull,
		indexBy : function(fn, arr){
			var index = {};
			for(var i = 0; i < arr.length; i++){
				var item = arr[i];
				var key = fn(item);
				var data = index[key];
				if(data){
					data.push(item);
				}else {
					data = [item];
					index[key] = data;
				}
			}
			return index;
		},
		first : first,
		storeCount : function(locationHierarchy){
			var locations = locationHierarchy.map(function (x) { return x.Locations; });
			var flatLocations = locations.reduce(function(a, b){ return a.concat(b); }, []);
			var stores = flatLocations.filter(function(x) { return x.LocationType === "1040"; });
			return stores.length;
		},
		decimalFormatter : function(value){
			return _oFormatter.format(value || "");
		},
		getSubstringEndText: function(start, text) {
			return text.substring(text.lastIndexOf(start) + start.length, text.length);
		},
		setSchemaVersion : function(schemaVersion) {
			this._schemaVersion = schemaVersion;
		},
		getSchemaVersion : function() {
			return this._schemaVersion;
		},
	};
	return Utils;
}, /* bExport= */ true);