/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
   		"sap/ui/core/mvc/Controller",
   		"sap/ui/model/json/JSONModel",
   		"retail/pmr/promotionaloffers/utils/Utils",
   		"retail/pmr/promotionaloffers/utils/Models",
   		"retail/pmr/promotionaloffers/plugins/general/dynamicfilter/DynamicFilterController",
   		"retail/pmr/promotionaloffers/plugins/general/LocationSelector",
   		"sap/ui/core/routing/History",
   		"sap/ui/model/Filter",
   		"sap/ui/model/FilterOperator"
   	], function(Controller, JSONModel, Utils, Models, DynamicFilterController, LocationSelector, History, Filter, FilterOperator) {
   	"use strict";

   	function transformDateValue(input){
		return new Date(parseInt(input.substring(input.indexOf("(") + 1, input.indexOf(")"))), 10);
	}
	function transformFilterValues(input){
		return input.map(function(i){
			var result = jQuery.extend(true, {}, i);
			if(result.Low.indexOf("Date") > -1){
				result.Low = transformDateValue(result.Low);
			}
			if(result.High.indexOf("Date") > -1){
				result.High = transformDateValue(result.High);
			}
			return result;
		});				
	}
   	
   	function getReason(excludedNode, i18nBundle) {
   		var reason = "";
		if(excludedNode.Reason === "C") {
			reason = i18nBundle.getText("General.LocationGroups.Overview.ReasonClosed");
		}
		return reason;
   	}
   	
   	function createPayloadFilter(uiFilter){
		
		return {
			Field : uiFilter.sPath,
			Sign : uiFilter.bAnd,
			Option : uiFilter.sOperator,
			Low : uiFilter.oValue1,
			High : uiFilter.oValue2
		};
	}
   	
   	function getPurposesForSet(data, offerData, i18n) {
		var purposes = ( data || [] ).map(function(purpose) {
			return {
				Id: purpose.PURPOSE_ID,
				Name: purpose.PURPOSE_DESC
			};
		});
		var prop = (offerData.LocationSubgroups || []).map(function(locGroup){
			return locGroup.Purpose;
		});
		
		var locationSubGroupsP = purposes.filter(function(purp){
			return prop.indexOf(purp.Id) !== -1;
		});
		
		var defaultAll = [{Id:"all", Name: i18n.getText("General.LocationGroups.Allstores")}];
		
		return {
			ProcessingPurposes: defaultAll.concat(locationSubGroupsP),
			Purposes: purposes
		};
	}
   	
   	function getDefaultItemsForPurposes(i18n) {
   		return [{
   			"Id": "none",
   			"Name": i18n.getText("General.LocationGroups.None"),
   			"Scope": "0"
   		},{
   			"Id": "offer",
   			"Name": i18n.getText("General.LocationGroups.OfferSpecific"),
   			"Scope": "1"
   		}];
   	}
   	function getPurposesGlobalsForSet(purposesObj, globals, offerData, i18n){
   		var purposes = purposesObj.Purposes;
   		var locSubgroups = offerData.LocationSubgroups || [];
   		var pGlobals = purposes.map(function(purpose) {
   			var defaultItems = getDefaultItemsForPurposes(i18n);
   			var g = globals.filter(function(global){
				return global.Purpose === purpose.Id;
			}).map(function(global) {
				return {
					Id: global.Id,
					Name: global.Name,
					Scope: "2"
				};
			});
   			var getIDsGlobal = g.map(function(global) {
				return  global.Id;
			});
   			var selectedKeyG = locSubgroups.filter(function(sub){
   				return getIDsGlobal.indexOf(sub.Id) !== -1;
   			});
   			var selectedKeyO = locSubgroups.some(function(loc){
   				return loc.Purpose === purpose.Id;
   			});
   			if(selectedKeyG.length) {
   				purpose.SelectedKey = selectedKeyG[0].Id;
   			} else if(selectedKeyO){
   				purpose.SelectedKey = "offer";
   			} else {
   				purpose.SelectedKey = "none";
   			}
   			
   			purpose.Items = defaultItems.concat(g);
   			return purpose;
   		});
   		return pGlobals;
   	}
	
   	function createFilterForSearchField(value, fields) {
   		var aFilters = [];
		if (value && value.length > 0) {
			aFilters = new Filter({ 
				filters: (fields || []).map(function(field) {
					return new Filter(field, sap.ui.model.FilterOperator.Contains, value);
				}),
				and: false 
			});
		}	
		
		return aFilters;
   	}
   	
   	function createManualFilter(store) {
		return {
			GroupId: 2,
			Field: "ExtLocationId",
			Option: "EQ",
			Sign: "I",
			Low: store.ExtLocationId
		};
	}
   	
   	function getLocationsFromHierarchy(locations, allStores) {
   		return locations.reduce(function(result, loc){
   			var id = loc.Id || loc.ExtLocationId;
			for(var i = 0, iLen = allStores.length; i < iLen; i++) {
				if(allStores[i].ExtLocationId === id){
					result.push(allStores[i]);
					break;
				}
			}						
			return result;
		}, []);
   	}
   	
   	function LocationGroupsOfferDataProvider(model){
   		this.getOfferData = function(){
   			return model.getData();
   		};
   	}
   	
   	function convertNullToEmptyString(filters) {
   		return (filters || []).map(function(filter){
			Object.keys(filter).forEach(function(prop){
	   			if(filter[prop] === null) {
	   				filter[prop] = "";
	   			}
	   		});
			return filter;
		});
   	}
   	
   	function setProps(model, data){
   		Object.keys(data).forEach(function(prop){
   			model.setProperty("/" + prop, data[prop]);
   		});
   	}
 
   	function getDate(val) {
		var dateInt = parseInt(val, 10);
		if(dateInt && dateInt.toString().length === 14){ 
			var year = val.substring(0,4);
			var month = val.substring(4,6);
			var day =  val.substring(6,8);
			var hour = val.substring(8,10);
			var min = val.substring(10,12);
			var sec = val.substring(12,14);
			var date = new Date();
			date.setYear(year);
			date.setMonth(parseInt(month, 10) - 1);
			date.setDate(day);
			date.setHours(hour);
			date.setMinutes(min);
			date.setSeconds(sec);
			if(Date.parse(date)) {
				return {
					date: date,
					valid: true
				};
			}
		}
		return {
			date: val,
			valid: false
		};
	}
   	
   	/**
	 * creates and returns a formatted text for the specified range
	 * 
	 * @param {object} oData the filter object
	 * @returns {string} the range token text
	 */
	function getFormattedRangeText(oData) {
		var sOperation = oData.Option;
		var sValue1 = oData.Low;
		var sValue2 = oData.High;
		var bExclude = oData.Sign === "E";
		var sTokenText;
		if (sValue1) {
			switch (sOperation) {
			case FilterOperator.Contains:
				sTokenText = "*" + sValue1 + "*";
				break;
			case FilterOperator.EQ:
				var sValue = sValue1;
				var date = getDate(sValue); 
				if(date.valid) {
					sValue = Utils.dateMedium(date.date);
				}
				if(oData.hasOwnProperty("Text") && oData.Text.length) {
					sValue = oData.Text + " (" + oData.Low + ")";
				}
				sTokenText = "=" + sValue;
				break;
			case FilterOperator.GT:
				sTokenText = ">" + sValue1;
				break;
			case FilterOperator.GE:
				sTokenText = ">=" + sValue1;
				break;
			case FilterOperator.LT:
				sTokenText = "<" + sValue1;
				break;
			case FilterOperator.LE:
				sTokenText = "<=" + sValue1;
				break;
			case FilterOperator.StartsWith:
				sTokenText = sValue1 + "*";
				break;
			case FilterOperator.EndsWith:
				sTokenText = "*" + sValue1;
				break;
			case FilterOperator.BT:
				if (sValue2) {
					sTokenText = sValue1 + "..." + sValue2;
				}
				break;
			default:
				sTokenText = sValue1;
				break;
			}
		}
	
		if (bExclude && sTokenText) {
			sTokenText = "!(" + sTokenText + ")";
		}
	
		return sTokenText;
	}
	
   	/**
	 * Used to get the filters for the table
	 * 
	 * @param {array} aFilters All filters
	 * @param {object} entity Location entity
	 * @returns {object} Object that contain the attribute, included and excluded filters
	 */
	var getFiltersForTable = function(aFilters, entity) {
		var attributes = entity.property.reduce(function(result, item){
			if(item.name) {
				result[item.name] = item["sap:label"];
			}
			return result;
		}, {});
		var oData = aFilters.reduce(function(result, data) {
			if(attributes[data.Field]) {
				data.Field = attributes[data.Field];
			}
			if(!result[data.Field]) {
				result[data.Field] = {
						Include: [],
						Exclude: []
				};
			}
			var formattedRange = getFormattedRangeText(data);
			if(data.Sign === "I") {
				result[data.Field].Include.push(formattedRange);
			} else {
				result[data.Field].Exclude.push(formattedRange);
			}
				return result;
			}, {});
		
		return Object.keys(oData).map(function(prop){
			return {
				Attribute: prop,
				Include: (oData[prop].Include || []).join(", "),
				Exclude: (oData[prop].Exclude || []).join(", ")
			};
		});
	};
	
   	var transformFiltersFromServerToUI = (function() {
		
		// In case the option is "CP", filter to get the correct one (Contains, StartsWith, EndsWith)
   		function setValue(filter) {
			if(filter.Option === "CP") {
				filter.Option = "Contains";
				 if(filter.Low.indexOf("*") === 0 && filter.Low.lastIndexOf("*") === filter.Low.length - 1) {
						filter.Low = filter.Low.substring(1, filter.Low.length);
						filter.Low = filter.Low.substring(0, filter.Low.length - 1);
					}
				else if(filter.Low.indexOf("*") === 0) {
					filter.Option = "EndsWith";
					filter.Low = filter.Low.substring(1, filter.Low.length);
				} else if(filter.Low.indexOf("*") === filter.Low.length - 1) {
					filter.Option = "StartsWith";
					filter.Low = filter.Low.substring(0, filter.Low.length - 1);
				}
			}
			
			//Set description if provided by backend
			if (filter.Option === "EQ" && filter.Text && filter.Text !== "" ) {
				filter.tokenText = filter.Text + " (" + filter.Low + ")";
				filter.value = filter.Low;
			} else {
				filter.tokenText = "";
			}
			return filter;
		}
   		
   		// Returns the object structure for filterBar
   		function toFilterRange(f) {
			var filter = setValue(f);
			return {
				exclude : filter.Sign === "E",
				keyField : filter.Field,
				operation : filter.Option,
				tokenText : filter.tokenText,
				value1 : filter.Low,
				value2 : filter.High
			};
		}
   		
		function toIntFilter(oFilter) {
			var oValues = setValue(oFilter);
			
			//Single values with text need to be handled as items, rest is range
			if (oValues.Option === "EQ" && oFilter.Sign !== "E") {
				return { 
					type: "item",
					object : {
						key : oValues.Low,
						text : oValues.tokenText
					}
				};
			} else {
				return {
					type: "range",
					object: {
						exclude : oValues.Sign === "E",
						keyField : oValues.Field,
						operation : oValues.Option,
						tokenText : oValues.tokenText,
						value1 : oValues.Low,
						value2 : oValues.High
					}
				};
			}
		}

		return function(aFilters) {
			var allFilters = [];
			
			aFilters.forEach( function(oCurrentFilter) {
			
				var sProperty = oCurrentFilter.Field;
				var oCurrentBlock = allFilters[sProperty] || { items : [], ranges : [] };
				
				allFilters[sProperty] = oCurrentBlock;
				var isDate = getDate(oCurrentFilter.Low); 
				if(isDate.valid) {
					oCurrentFilter.Low = getDate(oCurrentFilter.Low).date;
					oCurrentFilter.High = getDate(oCurrentFilter.High).date;
					oCurrentBlock.ranges.push(toFilterRange(oCurrentFilter));
					return;
				}
				
				var oFilter = toIntFilter(oCurrentFilter);
				if (oFilter.type === "range" ) {
					oCurrentBlock.ranges.push(oFilter.object);
				} else {
					oCurrentBlock.items.push(oFilter.object);	
				}
				
			});
			
			return allFilters;
		};
	}());
   	
   	function getLocationEntity() {
   		var oMetaModel = Models.getServiceModel().getMetaModel();
		var namespace = Models.getNamespace(Models.getServiceModel());
		return oMetaModel.getODataEntityType(namespace + ".Location");
   	}
   	
   	function setTableColumns(view) {
		var smartTable = view.byId("locationPurposeStoresSmartTable");
		var table = smartTable.getTable();
		var columns = table.getColumns();
		
		function notInTable(item) {
			for(var i = 0, iLen = columns.length; i < iLen; i++) {
				if(columns[i].data("p13nData").columnKey === item.property) {
					return false;
				}
			}
			return true;
		}
		
		var metaProperties = [];
		var colls = [];
		var entity = getLocationEntity();
		entity.property.forEach(function(prop){
			metaProperties.push({
				property : prop.name,
				label 	 : prop["sap:label"],
				visible	 : prop["sap:visible"] === "false" ? false : true
			});							
		});
		
		var oColumnListItem = new sap.m.ColumnListItem();
		
		view.byId("columnsTemplate").getCells().forEach(function(cell){
			oColumnListItem.addCell(cell);
		});
		smartTable._aColumnKeys = [];
		metaProperties.forEach(function(prop){
			if(notInTable(prop) && prop.visible) {
				colls.push(new sap.m.Column({
					header : new sap.m.Label({
		                text : prop.label,
		                tooltip: prop.label
		            }),
		            minScreenWidth: "Tablet",
		            demandPopin: true,
		            visible: false
				}).data("p13nData",  { 
					"columnKey": prop.property,
					"leadingProperty": prop.property,
					"sortProperty": prop.property,
					"filterProperty": prop.property
				}));							
				oColumnListItem.addCell(new sap.m.Text({
					 text : "{TreeModel>" + prop.property + "}"
				}));							
			}			
		});
		
		colls.forEach(function(col) {
		 	table.addColumn(col);
		});
		// force to recreate the personalisation controller
		smartTable._oPersController = null;
		smartTable._createPersonalizationController();
		table.bindItems("TreeModel>/Stores", oColumnListItem);
	}
   	
   	function formatDates(stores){
		return stores.map(function(item){
			var result = jQuery.extend(true, {}, item);
			for(var prop in result){
				if(prop.indexOf("Date") !== -1){
					if(result[prop] !== null && jQuery.isNumeric(result[prop])){
						var date = Utils.getFormatedDateForRead(new Date(result[prop]));
						result[prop] = Utils.dateMedium(date);
					}
				}
			}
			return result;
		});
	}
	
   	function filterStores(stores, excludedNodes){
		return stores.filter(function(store){
			for(var i = 0; i < excludedNodes.length; i++){
				var excludedStore = excludedNodes[i];
				if(excludedStore.Id === store.LocationId){
					return false;
				}
			}
			return true;
		});
		
	}
   	
   	function locationToFilterRange(node){
   		return {
			exclude: true,
			keyField: "ExtLocationId",
			operation: "EQ",
			tokenText: "",
			value1: node.ExtLocationId,
			value2: ""
		};
   	}
   	
   	function exclusionsToFilters(locations){
   		return {
   			ExtLocationId : {
				items: [],
				ranges: locations.map(locationToFilterRange)
			}
   		};
   	}
   	
   	
   	/*
	 * Is used for LocationSubgroups features.
	 */
   	function getLocationsFunctionalityWithSubgroups(contentModel) {
		return {
			getLocationSubgroupWithLocations: function() {
				var group =  contentModel.getProperty("/GroupByPurpose");
				return Object.keys(group).filter(function(prop){
					return prop !== "all";
				}).map(function(prop) {
					var result = jQuery.extend(true, {}, group[prop]);
					return result;
				}).reduce(function(index, data){
	   				index[data.Purpose] = data;
	   				return index;
	   			}, {});
			},
			
			getLocationSubgroup: function() {
				var group =  contentModel.getProperty("/GroupByPurpose");
				return Object.keys(group).filter(function(prop){
					return prop !== "all";
				}).map(function(prop) {
					var result = jQuery.extend(true, {}, group[prop]);
					result.Locations = [{}];
					result.Filters = convertNullToEmptyString(result.Filters);
					result.Filters = (result.Filters || []).filter(function(filter){
						return filter.GroupId !== 2;
					});
		 			return result;
				});
			},
			
			getLocationFilters : function(){
				var groups = contentModel.getProperty("/GroupByPurpose");
				var filters = convertNullToEmptyString(groups.all.Filters);
				filters = filters.filter(function(f){
					return f.GroupId !== 2;
				});
				
				return filters;
			},
			
			getLocationFiltersCombined: function() {
				var oFilterPurposes = contentModel.getProperty("/FilterPurposes");
	     		var subgroup = this.getLocationSubgroup();
	     		var locFilters = this.getLocationFilters().concat(oFilterPurposes.all || []);
	     		subgroup = subgroup.map(function(gr){
	     			gr.Filters = gr.Filters.concat(oFilterPurposes[gr.Purpose] || []);
	     			return gr;
	     		});
	     		return {
	     			locationFilters: locFilters,
	     			LocationSubgroup: subgroup
	     		};
			},
			
			separateFiltersByGroupId: function() {
				var oGroupByPurpose = contentModel.getProperty("/GroupByPurpose");
				var group = jQuery.extend(true, {}, oGroupByPurpose);
				var oFilterPurposes = {};
				var clonedFiltersPurposes = {};
				Object.keys(group).forEach(function(gr){
					group[gr].Filters = [];
					(oGroupByPurpose[gr].Filters || [] ).forEach(function(filter){
						if(filter.GroupId !== 2) {
			   				group[gr].Filters.push(filter);
			   			} else{
			   				if(!oFilterPurposes[gr]) {
			   					oFilterPurposes[gr] = [];
			   				}
			   				if(group[gr].Scope !== "2"){
			   					if(!clonedFiltersPurposes[gr]) {
				   					clonedFiltersPurposes[gr] = [];
				   				}
				   				clonedFiltersPurposes[gr].push(filter);
				   			}
			   				oFilterPurposes[gr].push(filter);
			   			} 
					});
					group[gr].Filters = convertNullToEmptyString(group[gr].Filters);
					oFilterPurposes[gr] = convertNullToEmptyString(oFilterPurposes[gr]);
		   		});
				contentModel.setProperty("/GroupByPurpose", group);
				contentModel.setProperty("/FilterPurposes", oFilterPurposes);
				
				var allStores = contentModel.getProperty("/AllStores");
				var includedStores = [];
				var included = {};
				for(var i in clonedFiltersPurposes) {
					(clonedFiltersPurposes[i] || []).forEach(function(filter){
						 if(!included[filter.Low]) {
							 var store = allStores.filter(function(storeElem){ 
								 return storeElem.ExtLocationId === filter.Low; 
							 });
							 included[filter.Low] = store[0];
						}
						 included[filter.Low][i + "Selected"] = true;
					});
				}
				for(var i in included) {
					includedStores.push(included[i]);
				}
				contentModel.setProperty("/IncludedStores", includedStores);
			}
		};
	}
	
	/*
	 * Is used for old version that doesent support subgroups.
	 */
	
	function getLocationsFunctionalityOnlyWithLocFilters(contentModel) {
		return {
			getLocationFiltersCombined: function() {
				var locFilters =  getLocationsFunctionalityWithSubgroups(contentModel).getLocationFilters().map(function(filter) {
					delete filter.GroupId;
					return filter;
				});
				
				return {
	     			locationFilters: locFilters,
	     			LocationSubgroup: null
	     		};
			},
			separateFiltersByGroupId: function() {}
		};
	}
	
   	return Controller.extend("retail.pmr.promotionaloffers.view.LocationGroups", {
   		constructor: function() {
   			this.dataModel = new JSONModel();
   			this.featuresAvailable = new JSONModel();
   			this.contentModel = new JSONModel({
				Busy : true,
				Stores : [],
				AllStores : [],
				ExcludedNodes : [],
				LocationFilters  : [],
				SelectedPurpose: "all",
				ProcessingPurposes: [],
				IncludedStores: [],
				GroupByPurpose: {
					"all": {
						Locations: [], 
						Filters:[],
						Scope: "1"
					}
				},
				Separator: "|",
				FilterPurposes: {},
				StoresLength: 0
			});
   			
   			this.i18nBundle = Utils.getResourceModel();
   		},
   		cancelRebind : function(oEvent){
			//version 1.38.18 and above crashes if table is rebound.
			//version 1.38.7 works fine with or without this.
			//so alwasy prevent rebind.
			oEvent.getParameter("bindingParams").preventTableBind = true;
		},
   		filterBarInitialized : function(oEvent){
   			this.filterBar = oEvent.getSource();
   		},
		
		
		setupFilterBar : function(filters){
			var cloneFilters = jQuery.extend(true, [], filters);
			cloneFilters.map(Utils.prop("Field")).forEach(function(item) {
				this.filterBar.addFieldToAdvancedArea(item);	
			}.bind(this));
			cloneFilters = transformFiltersFromServerToUI(cloneFilters);
			this.filterBar.setFilterData(cloneFilters, true);
		},
		
		handleRouteMatched: function(e) {
			var pathName = e.getParameter("name");
         	var state = this.state;
         	var offerData = state.getOfferData();
         	
         	if(pathName !== "locationGroups" && pathName !== "locationGroupsCreate") {
         		return;
         	}
         	if(pathName === "locationGroupsCreate" && (!offerData || Object.keys(offerData).length === 0)) {
     			this.router.navTo("manage");
     			return;
     		}
         	this.loadData();
		},
		
   		onInit: function() {
   			this.router = sap.ui.core.UIComponent.getRouterFor(this);
   			this.getView().setModel(this.contentModel, "TreeModel");
   			this.getView().setModel(this.dataModel, "DataModel");
   			this.getView().setModel(Models.getServiceModel());
   			this.getView().setModel(this.i18nBundle, "i18n");
   			this.getView().setModel(this.featuresAvailable, "featuresAvailable");
   			
   			this.state = this.getOwnerComponent().getState();
   			
	   		this.router.attachRouteMatched(function(e){
	         		this.handleRouteMatched(e);
	   		}, this);
	   		
	   		var storeTable = this.getView().byId("locationStoresTable");	
	   		
			storeTable.onAfterRendering = function() {};
			
			this.oMessageManager = Utils.getMessageManager();
   		},
   		
   		setData: function(offerData, result) {
     		var aData = result[0];
 			var puposes = result[1] || [];
 			var globals = result[2] || [];
 			var excludedNodes = offerData.ExcludedNodes || [];
			var includeExclude = {ID: this.dataModel.getData().LocationNodeId, ExcludeNodes: excludedNodes };
			var excludedIds = [];
			var model = this.contentModel;
			var startOfOffer = offerData.StartOfOffer;
     		var endOfOffer = offerData.EndOfOffer;
     		
     		// Set purposes
			var purposesObj = getPurposesForSet(puposes, offerData, this.i18nBundle.getResourceBundle());
			var purposesWithGlobals = getPurposesGlobalsForSet(purposesObj, globals, offerData, this.i18nBundle.getResourceBundle());
			this.contentModel.setProperty("/ProcessingPurposes", purposesObj.ProcessingPurposes);
			this.contentModel.setProperty("/Purposes", purposesObj.Purposes);
			this.contentModel.setProperty("/PurposesGlobal", purposesWithGlobals);
			
			aData.data.forEach(function(data){
				if(data.Locations.results.length) {
					data.Locations.results.forEach(function(location){
						var locationById = excludedNodes.filter(function(i){
							return i.Id === location.LocationId;
						});
						
						if(locationById.length) {
							// Create array with excluded nodes
							var isDuplicate = excludedIds.filter(function(node){
								return node.LocationId === locationById[0].Id;
							});
							if(!isDuplicate.length) {
								excludedIds.push(location);
							}
						}
						
						if(location.CustomAttributes.results.length) {
							// Add  the custom attributes to each location
							location.CustomAttributes.results.forEach(function(customAttr) {
								location[customAttr.Property] = customAttr.Description + " (" + customAttr.Value + ")";
							});
						}
					});
				}
			});
			
			var selector = new LocationSelector(null);
			selector.setData(includeExclude,aData.data,{
				StartOfOffer: startOfOffer.getTime(),
				EndOfOffer: endOfOffer.getTime()
			});

			var selections = selector.getSelection();
			var hierarchy = selections.selection;	
			var dynamicFilter = new DynamicFilterController(hierarchy);

			var dynamicFilterStores = dynamicFilter.getStores();
			if(dynamicFilterStores.length !== 0 && dynamicFilterStores.length > 100){
				model.setSizeLimit(dynamicFilterStores.length);
			}
			var stores = formatDates(filterStores(dynamicFilterStores || [], excludedNodes));
			
			// set the locations for each purpose
			var oGroupByPurpose = model.getProperty("/GroupByPurpose");
			Object.keys(oGroupByPurpose).forEach(function(gr){
				oGroupByPurpose[gr].Locations = formatDates(getLocationsFromHierarchy((oGroupByPurpose[gr].Locations || []), dynamicFilterStores));
			});
			oGroupByPurpose.all.Locations = stores;
			
			setProps(model, {
				AllStores : formatDates(dynamicFilterStores),
				Stores : stores,
				Busy : false,
				Separator: "|",
				StoresLength: stores.length,
				GroupByPurpose: oGroupByPurpose,
				FilterPurposes: {}
			});
			
			if(!(offerData.LocationFilters && offerData.LocationFilters.length)) {
				// In case we have excluded nodes
				this.filterBar.setFilterData(exclusionsToFilters(excludedIds));	
				var filters = this.getTransformFilters();
				oGroupByPurpose.all.Filters = filters.map(createPayloadFilter);
			}
			model.setProperty("/ExcludedNodes", offerData.ExcludedNodes);
			
			this.getLocationsFunctionality.separateFiltersByGroupId();
			
			var newGrPurposes = this.contentModel.getProperty("/GroupByPurpose");
			this.setupFilterBar(newGrPurposes.all.Filters || []);
			this.clearIncludedPurposes();
			this.applyIncludedPurposes();
   		},
   		initPurposeFunctionality: function(subGroupFeature) {
     		if(subGroupFeature === "X") {
     			this.getLocationsFunctionality = getLocationsFunctionalityWithSubgroups(this.contentModel);
     		} else {
     			this.getLocationsFunctionality = getLocationsFunctionalityOnlyWithLocFilters(this.contentModel);
     		}
   		},
   		
   		loadData : function(){
   			var that = this;
   			
   			if(that.filterBar){
   				that.filterBar.clear();
				that.showOverlay(false);
   			}
   			
   			var oGroupByPurpose = that.contentModel.getProperty("/GroupByPurpose");
   			setProps(this.contentModel, {
				Busy : true,
				Separator: "|",
				Stores : [],
				AllStores : [],
				ExcludedNodes : [],
				LocationFilters  : [],
				ProcessingPurposes: [],
				IncludedStores: [],
				GroupByPurpose: oGroupByPurpose,
				FilterPurposes: {},
				StoresLength: 0
			});
   			
   			this.state.load(function(){
   				var offerData = that.state.getOfferData();
         		var masterDatasystem = offerData.MasterdataSystem;
         		
         		if(!that.bTableColumnsCreated) {
         			setTableColumns(that.getView());
         			that.bTableColumnsCreated = true;
         			var smartTable = that.getView().byId("locationPurposeStoresSmartTable");
         			smartTable._oPersController.attachAfterP13nModelDataChange(function(event){
         				var aSorters = [];
         				if(event.getParameter("changeData").hasOwnProperty("sort")) {
	         				event.getParameter("changeData").sort.sortItems.forEach(function(item) {
	         					aSorters.push(new sap.ui.model.Sorter(item.columnKey, !(item.operation === "Ascending")));
	         				});
         				}
         				smartTable.getTable().getBinding("items").sort(aSorters);
         				that.showOverlay(false);
         			}.bind(that));
         		}
         		that.setOfferData(offerData);
         		
         		var getPurposesF = [];
         		var subGroupFeature = that.featuresAvailable.getProperty("/LocationSubgroups");
         		if(subGroupFeature === "X") {
         			getPurposesF.push({func: Models.getPurposes, params: {}});
         			getPurposesF.push({func: Models.getLocationSubgroups, params: {HierarchyId: offerData.HierarchyId}});
         		}
         		that.initPurposeFunctionality(subGroupFeature);
         		
         		Promise.all([Models.getLocationFiltered(masterDatasystem, "", offerData.ExtLocationNodeId, true, true)]
         			.concat(getPurposesF.map(function(fn) {return fn.func.call(Models, fn.params); }))).then(function(result){
         			that.setData.call(that, offerData, result);
         			//offerData.ExtHierarchyId =  Utils.get(aData, ["data", 0, "Name"]);
					that.setTitle();
					that.showOverlay(false);
				});
         	});
   		},
   	
   		setOfferData : function(offerData){
   			this.dataModel.setData(offerData);
   			var staticData = this.state.getStaticData();
   			var result = Utils.setupFeatures(staticData.FeaturesAvailable);
 			this.featuresAvailable.setData(result);
   			this.contentModel.setProperty("/SelectedPurpose", "all");
   			var locStored = this.state.getLocationSubgroups();
   			 var all = [{
    					Locations : [],
       					Filters : offerData.LocationFilters,
       					Purpose : "all"
       			}].concat(offerData.LocationSubgroups || []);
   			
   			var convert = all.reduce(function(index, data){
   				index[data.Purpose] = {
   					Purpose: data.Purpose,
   					Id: data.Id,
   					Filters: data.Filters,
					Locations:data.Locations,
					Scope: data.Scope || "1"
   				};
   				index[data.Purpose].Locations = (locStored[data.Purpose] || {}).Locations || data.Locations;
   				return index;
   			}, {});
   			this.contentModel.setProperty("/GroupByPurpose",  convert);
   			this.contentModel.setProperty("/Editable", !offerData.Readonly && !Utils.isReadOnly( {Status: offerData.Status, UIState: offerData.UIState} ));
   		},
   		
   		setTitle : function(){
   			var offerData = this.dataModel.getData();
   			var totalStores = Utils.storeCount(offerData.LocationHierarchy);
			var oGroupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var selectedStores = oGroupByPurpose.all.Locations.length || 0;
			this.setStoreCount(totalStores, selectedStores);
		},
		
		resetSearchFilter: function() {
			this.getView().byId("searchStore").setValue("");
			this.getView().byId("locationStoresTable").getBinding("items").filter([]);
		},
		
		setStoreCount : function(totalStores, selectedStores){
			var offerData = this.dataModel.getData();
   			
   			setProps(this.contentModel, {
				Purpose : this.i18nBundle.getResourceBundle().getText("CreateOffer.General.Location"),
				LocationHierarchyNode : offerData.ExtLocationNodeId || offerData.ExtHierarchyId,
				CurrentNumberOfStores : selectedStores,
				TotalNumberOfStores : totalStores
			});
		},
   		
   		getOfferDataProvider : function(){
   			return new LocationGroupsOfferDataProvider(this.dataModel);
   		},
   		onNavButtonPress : function(e){
   			this.oMessageManager.removeAllMessages();
   			var offerData = this.dataModel.getData();
   			offerData.ExcludedNodes = this.contentModel.getProperty("/ExcludedNodes");
   			var allFilters = this.getLocationsFunctionality.getLocationFiltersCombined();
   			offerData.LocationFilters = allFilters.locationFilters;
   			
   			// If LocationSubgroup feature is available
   			if(allFilters.LocationSubgroup) {
   				offerData.LocationSubgroups = allFilters.LocationSubgroup;
   				var locationSubgroupWithLocations = this.getLocationsFunctionality.getLocationSubgroupWithLocations();
   				this.state.storeLocationSubgroups(locationSubgroupWithLocations);
   			}
   			
   			this.state.store(offerData);
   			
   			var oHistory = sap.ui.core.routing.History.getInstance();
   			var sPreviousHash = oHistory.getPreviousHash();
   			this.state.storeBack(true);
 			if (sPreviousHash !== undefined) {
	 			window.history.go(-1);
 			} else {
 				var path = "edit";
 				var id = Utils.base64ToHex(this.dataModel.getProperty("/OfferId"));
 				if(Utils.isReadOnly( {Status: offerData.Status, UIState: offerData.UIState} )) {
 	   				path = "display";
 	   			} 
 				this.router.navTo(path, {
 					path : id
 				}, true);
 			}
   		},
   		onDynamicLocationFilterChange : function(oEvent){
			this.showOverlay(false);
			var parameter = oEvent.getParameter("mParameters") && oEvent.getParameter("mParameters").filterChangeReason; 
			if(parameter){
				this.showOverlay(true);
			}						
		},
		
		onDataReceivedFromSearch: function(result) {
			var model = this.contentModel;
			var data = model.getData();
			var statusCode = Utils.get(result, ["returnedData", "__batchResponses", 0, "__changeResponses", 0, "statusCode"]);
			if(statusCode !== "200") {
				data.Stores = []; 
				data.GroupByPurpose.all.Locations = [];
				data.StoresLength = data.Stores.length;
				this.setStoreCount(data.AllStores.length, 0);
				model.setProperty("/Busy", false);
				this.resetSearchFilter();
				model.refresh(true);
				var body =  JSON.parse(Utils.get(result, ["returnedData", "__batchResponses", 0, "response", "body"]) || {});
				if(body.error && body.error.message){
					Utils.getErrorHandler().showError(statusCode + ":" + body.error.message.value);
				}
				return;
			}
			data.ExcludedNodes = Utils.get(result, ["returnedData", "__batchResponses", 0, "__changeResponses", 1, "data", "ExcludedNodes", "results"]) || [];
			
			data.FilterPurposes = {};
			var locFilters = transformFilterValues(Utils.get(result, ["returnedData", "__batchResponses", 0, "__changeResponses", 1, "data", "LocationFilters", "results"]) || []);
			locFilters.map(function(filter){
				if(filter.GroupId === 2){
						if(!data.FilterPurposes.all) {
							data.FilterPurposes.all = [];
						}
						data.FilterPurposes.all.push(filter);
				}
				return filter;
			 }).filter(function(f){
				 return f.GroupId !== 2;
			 });
			if (data.SelectedPurpose === "all") {
			 	data.GroupByPurpose[data.SelectedPurpose].Filters = locFilters || [];
			}
			data.GroupByPurpose.all.Locations = formatDates(filterStores(data.AllStores, data.ExcludedNodes));
			var locationSubgroups = (Utils.get(result, ["returnedData", "__batchResponses", 0, "__changeResponses", 1, "data", "LocationSubgroups", "results"]) || []);
			locationSubgroups.map(function(locSub){
				var group = data.GroupByPurpose[locSub.Purpose];
				group.Filters = transformFilterValues(Utils.get(locSub, ["Filters", "results"]) || []).map(function(filter){
					if(filter.GroupId === 2){
						if(!data.FilterPurposes[locSub.Purpose]) {
							data.FilterPurposes[locSub.Purpose] = [];
						}
						data.FilterPurposes[locSub.Purpose].push(filter);
					}
					return filter;
				}).filter(function(f){
					return f.GroupId !== 2;
				});
				var locs = Utils.get(locSub, ["Locations", "results"]) || [];
				group.Locations = getLocationsFromHierarchy(locs, data.AllStores);
				
			});
			data.Stores = data.GroupByPurpose[data.SelectedPurpose].Locations; 
			if( data.GroupByPurpose[data.SelectedPurpose].Scope === "2") {
				data.TableFilters = getFiltersForTable(jQuery.extend(true, [],  data.GroupByPurpose[data.SelectedPurpose].Filters), getLocationEntity());
			}
			data.StoresLength = data.Stores.length;
			this.setStoreCount(data.AllStores.length, data.GroupByPurpose.all.Locations.length);
			model.setProperty("/Busy", false);
			this.resetSearchFilter();
			this.clearIncludedPurposes();
			this.applyIncludedPurposes();
			model.refresh(true);
		},
		
		searchDynamicLocation : function(oEvent){
			this.showOverlay(false);	
			var filters = this.getTransformFilters();
			var selectedProp = this.contentModel.getProperty("/SelectedPurpose");
			var group = this.contentModel.getProperty("/GroupByPurpose");
			group[selectedProp].Filters = filters.map(createPayloadFilter);  
			
			var offerData = this.dataModel.getData();
			var masterDatasystem = offerData.MasterdataSystem;
     		var locationNodeId = offerData.LocationNodeId;
     		var hierarchyId = offerData.HierarchyId;
     		var dates =  {
     				start: Utils.getFormatedDateForSave(offerData.StartOfOffer),
     				end: Utils.getFormatedDateForSave(offerData.EndOfOffer)
     		};
     		this.contentModel.setProperty("/Busy", true);
     		var allFilters = this.getLocationsFunctionality.getLocationFiltersCombined();
     		var that = this;
     		Models.determineLocations(masterDatasystem, locationNodeId, hierarchyId, allFilters.locationFilters, allFilters.LocationSubgroup, dates).then(that.onDataReceivedFromSearch.bind(that));
		},
		
		showOverlay : function(flag){
			this.getView().byId("locationPurposeStoresSmartTable")._showOverlay(flag);
		},
		
		getTransformFilters: function() {
			function transformFilters(filters){
				var result = [];
				var bAnd = "";
				result = iterate(filters, bAnd, result);
				return result;
			}

			function iterate(array, bAnd, result){
				for(var i = 0; i < array.length; i++){
					if(array[i].bAnd === true){
						bAnd = "E";
					}
					if(array[i].bAnd === false){
						bAnd = "I";
					}
					if(array[i].aFilters && array[i].aFilters.length){
						iterate(array[i].aFilters, bAnd, result);
					} else {
						array[i].bAnd = bAnd;
						result.push(array[i]);
					}
				}
				return result;
			}

			var options = {
				"EQ": "EQ",
				"Contains": "CP",
				"BT": "BT",
				"EndsWith": "CP",
				"StartsWith": "CP",
				"GT": "GT",
				"GE": "GE",
				"LT": "LT",
				"LE": "LE",
				"NE": "NE",
				"OpeningDate" : "OD"
			};
			var originalFilters = this.filterBar.getFilters();

			var filters = transformFilters(originalFilters);
			var transformedFilters = filters.map(function(filter){
				var value1 = filter.oValue1; 
				if(value1 && value1 instanceof Date){
					value1 =  Utils.getFormatedStringDate(value1);
				}
				var value2 = filter.oValue2; 
				if(value2 && value2 instanceof Date){
					value2 = Utils.getFormatedStringDate(value2);
				}
				var operator = null; 
				if(filter.bAnd === "E"){
					operator = "EQ";
				} else {
					operator = options[filter.sOperator];
				}
				
				return {
					bAnd : filter.bAnd,
					oValue1 : value1,
					oValue2 : value2 || "",
					sOperator : operator,
					sPath : filter.sPath
				};
			}).filter(function(filter) {
				return filter.sOperator !== "CP";
			});
			var filterData = this.filterBar.getFilterData();
			var fRanges = [];
			 Object.getOwnPropertyNames(filterData).forEach(function(name) {
				var filter = filterData[name];
				(filter.ranges || []).forEach(function(item){
					if(["StartsWith"].indexOf(item.operation) !== -1) {
						fRanges.push({
							bAnd : item.exclude ? "E" : "I",
							oValue1 : item.value1 + "*",
							oValue2 : item.value2 || "",
							sOperator: "CP",
							sPath : name
						});
					} else if(["EndsWith"].indexOf(item.operation) !== -1){
						fRanges.push({
							bAnd : item.exclude ? "E" : "I",
							oValue1 : "*" + item.value1 ,
							oValue2 : item.value2 || "",
							sOperator: "CP",
							sPath : name
						});
					}
					else if(["Contains"].indexOf(item.operation) !== -1){
						fRanges.push({
							bAnd : item.exclude ? "E" : "I",
							oValue1 : "*" + item.value1 + "*",
							oValue2 : item.value2 || "",
							sOperator: "CP",
							sPath : name
						});
					}
				});
			});
			return transformedFilters.concat(fRanges);

		},
		
		onStoreSearch: function(oEvent) {
			var sQuery = oEvent.getSource().getValue();
			var fields = ["ExtLocationId", "Name"];
			var aFilters = createFilterForSearchField(sQuery, fields);
			
			var binding = this.getView().byId("locationStoresTable").getBinding("items");
			binding.filter(aFilters, "Application");
			this.contentModel.setProperty("/StoresLength", binding.getLength());
		},
		
		handleAddLocationSearch: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			var fields = ["ExtLocationId", "Name"];
			var aFilters = createFilterForSearchField(sValue, fields);
			
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},
		
		onManualStoreSearch: function(oEvent){
			var sQuery = oEvent.getSource().getValue();
			var fields = ["ExtLocationId", "Name"];
			var aFilters = createFilterForSearchField(sQuery, fields);
			
			var binding = sap.ui.getCore().byId("manualStoresSelectionTable").getBinding("items");
			binding.filter(aFilters, "Application");
		},
		
		onOverviewSearch: function(oEvent){
			var sQuery = oEvent.getSource().getValue();
			var fields = ["ExtLocationId", "Name"];
			var aFilters = createFilterForSearchField(sQuery, fields);
			
			var binding = sap.ui.getCore().byId("overviewTable").getBinding("items");
			binding.filter(aFilters, "Application");
			this.contentModel.setProperty("/Overview/StoresLength", binding.getLength());
		},
		
		applyIncludedPurposes: function() {
			var includedStores = this.contentModel.getProperty("/IncludedStores");
			var filterPurposes = this.contentModel.getProperty("/FilterPurposes");
			var allPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			allPurposes.filter(function(purpose){
				return purpose.Id !== "all";
			}).forEach(function(purpose){
				(filterPurposes[purpose.Id] || []).forEach(function(filter){
					includedStores.forEach(function(included){
						if(included.ExtLocationId === filter.Low) {
							included[purpose.Id + "Selected"] = true;
						}
					});
				});
			});
			this.contentModel.setProperty("/IncludedStores", includedStores);
		},
		
		clearIncludedPurposes: function() {
			var allPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var includedStores = this.contentModel.getProperty("/IncludedStores");
			allPurposes.filter(function(purpose){
				return purpose.Id !== "all";
			}).forEach(function(purpose){
				includedStores.forEach(function(store) {
					store[purpose.Id + "Selected"] = false;
				});
			});
			this.contentModel.setProperty("/IncludedStores", includedStores);
		},
		
		handleAddPurpose: function(oEvent) {
			var purposes = this.contentModel.getProperty("/PurposesGlobal");
			var comboValues = [{Id:"all", Name: this.i18nBundle.getResourceBundle().getText("General.LocationGroups.Allstores")}];//this.contentModel.getProperty("/ProcessingPurposes");
			var group = this.contentModel.getProperty("/GroupByPurpose");
			purposes.forEach(function(purpose){
				var selectedPurpose = purpose.Items.filter(function(item){
					return item.Id === purpose.SelectedKey;
				})[0];
				if(selectedPurpose.Scope !== "0") {
					group[purpose.Id] = {
						Purpose: purpose.Id,
						Id: selectedPurpose.Scope === "2" ? selectedPurpose.Id : "",
						Filters: selectedPurpose.Scope === "2" ? [] : (group[purpose.Id] || {}).Filters,
						Locations:[{}],
						Scope: selectedPurpose.Scope
					};
					comboValues.push(purpose);
				} else {
					delete group[purpose.Id];
				}
			});
			var defaultSel = purposes.filter(function(purpose){
				return purpose.SelectedKey !== purpose.SelectedKeyTemp && purpose.SelectedKey !== "none";
			});
			
			if(defaultSel.length) {
				this.contentModel.setProperty("/SelectedPurpose", defaultSel[0].Id);
			} else if(!group[this.contentModel.getProperty("/SelectedPurpose")]) {
				this.contentModel.setProperty("/SelectedPurpose", "all");
			}
			
			this.handleLocationSubgroupChange();
			this.contentModel.setProperty("/ProcessingPurposes", comboValues);
			this.contentModel.setProperty("/GroupByPurpose", group);
			this.searchDynamicLocation();
			this.oSelectDialog.close();
		},
		
		onAddPressed: function(oEvent) {
			if (!this.oSelectDialog) {
				this.oSelectDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.ProcessingPurposeDialog", this);
				this.getView().addDependent(this.oSelectDialog);
				this.oSelectDialog.setModel(this.contentModel, "Content");
			}
			var globalPurpose = this.contentModel.getProperty("/PurposesGlobal");
			// set a temporary selected key
			globalPurpose.forEach(function(global) {
				global.SelectedKeyTemp = global.SelectedKey;
			});
			this.contentModel.refresh(true);
			this.oSelectDialog.open();
		},
		onRemovePressed: function(oEvent) {
			if (!this.oDeletePurposesDialog) {
				this.oDeletePurposesDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.DeletePurposesDialog", this);
				this.getView().addDependent(this.oDeletePurposesDialog);
				this.oDeletePurposesDialog.setModel(this.contentModel, "Content");
			}
			var oProcessingPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var removePurposesAvailable = oProcessingPurposes.filter(function(purpose) {
				return purpose.Id !== "all";
			});
			this.contentModel.setProperty("/ProcessingPurposesRemove", removePurposesAvailable);
			this.oDeletePurposesDialog.open();
		},
		
		handleRemovePurpose: function(oEvent) {
			var selectedPurposes = oEvent.getParameter("selectedItems");
			var allPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var groupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var oFilterPurposes = this.contentModel.getProperty("/FilterPurposes");
			var selectedPurposesIds = [];
			this.clearIncludedPurposes();
			selectedPurposes.forEach(function(selectedPurpose){
				delete groupByPurpose[selectedPurpose.getDescription()];
				delete oFilterPurposes[selectedPurpose.getDescription()];
				selectedPurposesIds.push(selectedPurpose.getDescription());
			});
			
			var globalPurpose = this.contentModel.getProperty("/PurposesGlobal");
			globalPurpose = globalPurpose.forEach(function(purpose){
				if(selectedPurposesIds.indexOf(purpose.Id) !== -1) {
					purpose.SelectedKey = "none";
				}
			});
			
			allPurposes = allPurposes.filter(function(purpose) {
				return selectedPurposesIds.indexOf(purpose.Id) === -1;
			});
			this.contentModel.setProperty("/ProcessingPurposes", allPurposes);
			this.contentModel.setProperty("/SelectedPurpose", "all");
			this.applyIncludedPurposes();
			this.handleLocationSubgroupChange();
		},
		
		setColumnsOnManualStoresSelection: function() {
			var table = sap.ui.getCore().byId("manualStoresSelectionTable");
			var colListTemplate = sap.ui.getCore().byId("columnsManualTemplate");
			var purposes = this.contentModel.getProperty("/ProcessingPurposes");
			var oGroupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			table.addColumn( new sap.m.Column({ header: new sap.m.Label({text: this.i18nBundle.getResourceBundle().getText("General.LocationGroups.ManualStoreSelection.Location")})}));
			table.addColumn( new sap.m.Column({ header: new sap.m.Label({text: this.i18nBundle.getResourceBundle().getText("General.LocationGroups.ManualStoreSelection.Name")})}));
			purposes.forEach(function(purpose){
				table.addColumn( new sap.m.Column({
					hAlign: "Center",
					header: new sap.m.Label({
						text: purpose.Name
					})
				}));
			});
			
			colListTemplate.addCell( new sap.m.Text({ text: "{Content>ExtLocationId}" }));
			colListTemplate.addCell( new sap.m.Text({ text: "{Content>Name}" }));
			var editabled = this.contentModel.getProperty("/Editable");
			purposes.forEach(function(purpose){
				if(purpose.Id === "all") {
					colListTemplate.addCell( new sap.ui.core.Icon({ src: "sap-icon://accept" }));
				} else {
					colListTemplate.addCell( new sap.m.CheckBox({ 
						selected: "{Content>" + purpose.Id + "Selected}",
						enabled: editabled && oGroupByPurpose[purpose.Id].Scope !== "2"
					}));
				}
			});
		},
		
		getStoresForOverview: function() {
			var stores = {
					AllStores: [],
					OnlyIncludedStores: []
			};
			var i18nBundle = this.i18nBundle.getResourceBundle();
			var aIncluded = this.contentModel.getProperty("/IncludedStores");
			var oGroupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var allStores = jQuery.extend(true, [], this.contentModel.getProperty("/AllStores"));
			var allPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var excludedNodes = this.contentModel.getProperty("/ExcludedNodes") || [];
			var oFilterPurposes = this.contentModel.getProperty("/FilterPurposes");
			var includedStores = jQuery.extend(true, [], oGroupByPurpose.all.Locations);
			var oStores = {};
			
			// create a object with all included stores
			includedStores.forEach(function(store) {
				oStores[store.ExtLocationId] = store;
			});
			
			// set the subgroups icon
			Object.keys(oGroupByPurpose).forEach(function(group){
				oGroupByPurpose[group].Locations.forEach(function(store) {
					if(oStores[store.ExtLocationId]) {
						oStores[store.ExtLocationId][group + "Icon"] = "sap-icon://accept";
						oStores[store.ExtLocationId][group + "Tooltip"] = "";
					}
				});
			});
			
			// set manual inclusions
			aIncluded.forEach(function(store){
				allPurposes.forEach(function(purpose){
					if(store[purpose.Id + "Selected"] && oStores[store.ExtLocationId]) {
						oStores[store.ExtLocationId][purpose.Id + "Icon"] = "sap-icon://kpi-managing-my-area";
						oStores[store.ExtLocationId][purpose.Id + "Tooltip"] = i18nBundle.getText("General.LocationGroups.Overview.ManuallyAdded");
					}
				});
			});
			
			stores.OnlyIncludedStores = Object.keys(oStores).map(function(store) {
				return oStores[store];
			});
			
			//set other stores from all stores
			allStores.forEach(function(store){
				if(!oStores[store.ExtLocationId]) {
					oStores[store.ExtLocationId] = store;
				}
			});
			
			// set global included stores
			Object.keys(oGroupByPurpose).filter(function(prop) {
				return oGroupByPurpose[prop].Scope === "2";
			}).forEach(function(purposeId) {
				(oFilterPurposes[purposeId] || []).forEach(function(filter) {
					if(oStores[filter.Low]) {
						oStores[filter.Low][purposeId + "Icon"] = "sap-icon://kpi-managing-my-area";
						oStores[filter.Low][purposeId + "Tooltip"] = i18nBundle.getText("General.LocationGroups.Overview.ManuallyAdded");
					}
				});
			});
			
			// set excluded stores
			if(excludedNodes.length) {
				excludedNodes.forEach(function(excludedNode){
					var location = allStores.filter(function(store){
						return store.LocationId === excludedNode.Id;
					});
					if(location.length) {
						oStores[location[0].ExtLocationId]["ExcludedReason"] = getReason(excludedNode, i18nBundle);
					}
				});
			}
			
			stores.AllStores = Object.keys(oStores).map(function(store) {
				return oStores[store];
			});
			
			return stores;
		},
		
		setOverviewModel: function() {
			var oGroupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var aPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var stores = this.getStoresForOverview();
			var overviewData = {
					Groups:[],
					AllStores: stores.AllStores,
					Stores: stores.OnlyIncludedStores,
					OnlyIncludedStores: stores.OnlyIncludedStores,
					StoresLength: stores.OnlyIncludedStores.length
			};
			
			aPurposes.forEach(function(purpose) {
				overviewData.Groups.push({
					NrLocs: (oGroupByPurpose[purpose.Id].Locations || []).length,
					Name: purpose.Name
				});
			});
			this.contentModel.setProperty("/Overview", overviewData);
		},
		
		
		setOverviewColumns: function() {
			var table = sap.ui.getCore().byId("overviewTable");
			var colListTemplate = sap.ui.getCore().byId("columnsOverviewTemplate");
			var purposes = this.contentModel.getProperty("/ProcessingPurposes");
			var resourceBundle = this.i18nBundle.getResourceBundle();
			table.addColumn( new sap.m.Column({ header: new sap.m.Label({text: this.i18nBundle.getResourceBundle().getText("General.LocationGroups.ManualStoreSelection.Location")})}));
			table.addColumn( new sap.m.Column({ header: new sap.m.Label({text: this.i18nBundle.getResourceBundle().getText("General.LocationGroups.ManualStoreSelection.Name")})}));
			purposes.forEach(function(purpose){
				var name = purpose.Id === "all" ? resourceBundle.getText("CreateVersion.General.LocationHierarchy") : purpose.Name;
				table.addColumn( new sap.m.Column({
					header: new sap.m.Label({text: name}),
					minScreenWidth: "Tablet",
					demandPopin: true,
					hAlign: "Center"
				}));
			});
			
			colListTemplate.addCell( new sap.m.Text({ text: "{Content>ExtLocationId}" }));
			colListTemplate.addCell( new sap.m.Text({ text: "{Content>Name}" }));
			purposes.forEach(function(purpose){
					var vBox = new sap.m.VBox();
					var icon =  new sap.ui.core.Icon({ 
						src: "{Content>" + purpose.Id + "Icon}",
						visible: "{= ${Content>" + purpose.Id + "Icon} === '' ? false : true}",
						tooltip: "{Content>" + purpose.Id + "Tooltip}"
					});
					vBox.addItem(icon);
					
					if(purpose.Id === "all") {
						var text = new sap.m.Text({
							text: "{Content>ExcludedReason}",
							visible: "{= ${Content>ExcludedReason} ? true : false}"
						});
						vBox.addItem(text);
					}
					colListTemplate.addCell(vBox);
			});
		},
		
		applyOverviewData: function(field) {
			// clear search field
			sap.ui.getCore().byId("searchOverview").setValue("");
			sap.ui.getCore().byId("overviewTable").getBinding("items").filter([]);
			
			// set stores
			var data = this.contentModel.getData();
			data.Overview.Stores = data.Overview[field];
			data.Overview.StoresLength = data.Overview.Stores.length;
			this.contentModel.refresh(true);
		},
		
		showOnlyIncludedStores: function(oEvent) {
			this.applyOverviewData("OnlyIncludedStores");
		},
		
		showAllStores: function(oEvent) {
			this.applyOverviewData("AllStores");
		},
		
		onOverviewPressed: function(oEvent){
			this.oOverviewDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.OverviewPurposesDialog", this);
			
			this.getView().addDependent(this.oOverviewDialog);
			this.setOverviewModel();
			this.setOverviewColumns();
			this.oOverviewDialog.setModel(this.contentModel, "Content");
			
			this.oOverviewDialog.open();
		},
		
		onOverviewClosePressed: function() {
			this.oOverviewDialog.close();
		},
		
		onOverviewAfterClose: function() {
			this.oOverviewDialog.destroy();
		},
		
		onManualStoreSelectionPressed: function(oEvent){
			this.oManualStoreSelDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.ManualStoreSelectionDialog", this);
			this.setColumnsOnManualStoresSelection();
			this.oManualStoreSelDialog.setModel(this.contentModel, "Content");
			this.oManualStoreSelDialog.setModel(Models.getServiceModel());
			this.getView().addDependent(this.oManualStoreSelDialog);
			var aIncluded = this.contentModel.getProperty("/IncludedStores");
			this.includedStoreTemp = jQuery.extend(true, [], aIncluded);
			this.oManualStoreSelDialog.open();
		},
		
		handleLocationSubgroupChange: function(oEvent) {
			var selPurpose = this.contentModel.getProperty("/SelectedPurpose");
			var group = this.contentModel.getProperty("/GroupByPurpose");
			var filters = group[selPurpose].Filters || [];
			
			if(group[selPurpose].Scope === "2" || !this.contentModel.getProperty("/Editable")) {
				var filtersTable = getFiltersForTable(jQuery.extend(true, [], filters), getLocationEntity());
				this.contentModel.setProperty("/TableFilters", filtersTable);
			} else {
				this.setupFilterBar(filters);
			}
			
			var locations = group[selPurpose].Locations || [];
			this.contentModel.setProperty("/Stores", locations);
			this.contentModel.setProperty("/StoresLength", locations.length);
			this.resetSearchFilter();
			this.showOverlay(false);
		},
		
		onAfterClose: function(oEvent) {
			this.oManualStoreSelDialog.destroy();
		},
		
		onClose: function(oEvent) {
			this.contentModel.setProperty("/IncludedStores", this.includedStoreTemp);
			this.oManualStoreSelDialog.close();
		},
		
		handleCloseDialog: function(oEvent) {
			oEvent.getSource().getBinding("items").filter([]);
		},
		
		handleClosePurposeDialog: function(oEvent) {
			var globalPurpose = this.contentModel.getProperty("/PurposesGlobal");
			// reset the selected key
			globalPurpose.forEach(function(global){
				global.SelectedKey = global.SelectedKeyTemp;
			});
			
			this.oSelectDialog.close();
		},
		
		onManualStoreAdd: function(oEvent){
			if (!this.oAddManualStoreDialog) {
				this.oAddManualStoreDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.AddManualStoreDialog", this);
				this.oAddManualStoreDialog.setModel(this.contentModel, "Content");
				this.getView().addDependent(this.oAddManualStoreDialog);
			}
			this.oAddManualStoreDialog.open();
		},
		
		onManualStoreDelete: function(oEvent){
			var aIncluded = this.contentModel.getProperty("/IncludedStores");
			var sPath = oEvent.getParameter("listItem").getBindingContext("Content").getPath();
			var aTemp = sPath.split("/");
			var iRowIndex = aTemp[aTemp.length - 1];
			aIncluded.splice(iRowIndex, 1);
			this.contentModel.updateBindings();
		},
		
		onManualStoreConfirm: function(oEvent){
			var allIncludedStores = this.contentModel.getProperty("/IncludedStores");
			var aPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var purposesIds = aPurposes.map(function(purp){
				return purp.Id;
			});
			
			var filterPurposes = {};
			allIncludedStores.forEach(function(store){
				purposesIds.forEach(function(id){
					if(store[id + "Selected"]) {
						if(!filterPurposes[id]) {
							filterPurposes[id] = [];
						}
						filterPurposes[id].push(createManualFilter(store));
					}
				});
			});
			this.contentModel.setProperty("/FilterPurposes", filterPurposes);
			this.oManualStoreSelDialog.close();
			this.searchDynamicLocation();
		},
		
		handleSearchPurpose: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			var fields = ["Id", "Name"];
			var aFilters = createFilterForSearchField(sValue, fields);
			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},
		
		onAddManualStoreConfirm: function(oEvent){
			var selectedItems = oEvent.getParameter("selectedItems");
			var includedStores = this.contentModel.getProperty("/IncludedStores");
			var selIds = [];
			var aPurposes = this.contentModel.getProperty("/ProcessingPurposes");
			var groupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var purposesIds = aPurposes.filter(function(purpose){
				return purpose.Id !== "all" && groupByPurpose[purpose.Id].Scope !== "2";
			}).map(function(purp){
				return purp.Id;
			});
			selectedItems.forEach(function(item){
				var obj = item.getBindingContext("Content").getObject();
				selIds.push(obj.ExtLocationId);
				var isInTable = includedStores.filter(function(store){
					return store.ExtLocationId === obj.ExtLocationId;
				}).length > 0;
				if(!isInTable) {
					purposesIds.forEach(function(purpose){
						obj[purpose + "Selected"] = true;
					});
					obj.allSelected = true;
					includedStores.push(obj);
				}
			});
			
			this.contentModel.setProperty("/IncludedStores", includedStores);
		},
		
		onCopyAsLocalPressed: function() {
			var selectedPurposes = this.contentModel.getProperty("/SelectedPurpose");
			var groupByPurpose = this.contentModel.getProperty("/GroupByPurpose");
			var globalPurpose = this.contentModel.getProperty("/PurposesGlobal");
			groupByPurpose[selectedPurposes].Scope = "1";
			groupByPurpose[selectedPurposes].Id = "";
			globalPurpose = globalPurpose.map(function(purpose){
				if(purpose.Id === selectedPurposes) {
					purpose.SelectedKey = "offer";
				}
				return purpose;
			});
			this.applyIncludedPurposes();
			this.setupFilterBar(groupByPurpose[selectedPurposes].Filters || []);
			this.showOverlay(false);
			this.contentModel.refresh(true);
		},
		
		/**
		 	{path:'i18n>Purposes.SubTitle'},
			{path:'TreeModel>/Purpose'},
			{path:'TreeModel>/LocationHierarchyNode'},
			{path:'TreeModel>/CurrentNumberOfStores'},
			{path:'TreeModel>/TotalNumberOfStores'}],
		 */
		formatTitle : function(subTitle, purpose, nodeName, currentNumberOfStores, totalNumberOfStores){
			if(!nodeName){
				return this.i18nBundle.getResourceBundle().getText("Purposes.Title");
			}else {
				return jQuery.sap.formatMessage.apply(jQuery.sap, arguments);
			}
		},
		smartFilterBarVisible: function(editable, selected, group) {
			return editable && group[selected].Scope !== "2";
		},
		
		CopyLocalLink: function(editable, selected, group) {
			return editable && group[selected].Scope === "2";
		}
   	});

});