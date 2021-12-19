/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
    		"sap/ui/model/resource/ResourceModel",
    		"sap/ui/model/json/JSONModel",
    		"retail/pmr/promotionaloffers/utils/Models",
    		"sap/ui/comp/filterbar/FilterGroupItem",
    		"sap/m/MultiInput",
    		"sap/ui/comp/valuehelpdialog/ValueHelpDialog",
    		"sap/ui/comp/filterbar/FilterBar"
    	], function(ResourceModel, JSONModel, Models, FilterGroupItem, MultiInput, HelpDialog, FilterBar) {
	"use strict";
	
	
	var OPTION_CONST = {
			bt: function(){return "BT"; },
			cp: function(){return "CP"; },
			endswith: function(){return "CP"; },
			startswith: function(){return "CP"; },
			eq: function(){return "EQ"; },
			nb: function(){return "NB"; },
			ne: function(){return "NE"; },
			np: function(){return "NP"; }		
	};
	
	var SIGN_CONST = {
		include: function(){return "I"; },
		exclude: function(){return "E"; }		
	};
	
	
	var ValueHelpDialog = {
		filterValues: [],
		createPayload: function(settings,termObjects,filters){
			var hasUserFilters = !jQuery.sap.equal(settings.filters, filters);
			var defaultFilters = [];
			var payload = {
					"Action": settings.action,					
					"Skip": settings.skip,
					"Top": hasUserFilters ? settings.topForSearch : settings.top,
					"TermObjects": [],
					"Filters": defaultFilters
					};
			
			for(var i = 0; i < termObjects.length; i++) {
				payload.TermObjects.push(termObjects[i]);
			}
			
			for(var j = 0; j < filters.length; j++) {
				payload.Filters.push(filters[j]);
			}

			return payload;
		},
		create:function(service, endpoint,payload){
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					service.create(endpoint,payload,{	
				   		async: true,
			   			success : function(data){
				   			resolve({data:data});
			   			}, 
						error : reject
					});
				}, 100);
			});
		},
		read: function(service, endpoint){
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					service.read(endpoint,{	
				   		async: true,
			   			success : function(data){
				   			resolve({data:data});
			   			}, 
						error : reject
					});
				}, 100);
			});
		},
		bindItems: function(bindData,table){
			var returnData = bindData.data;
			var oRowsModel = new JSONModel();
			if(returnData.TermObjects) {
				oRowsModel.setData(returnData.TermObjects.results);
			} else {
				oRowsModel.setData([]);
			}
			
			table.setShowNoData(true);
			table.setModel(oRowsModel);
			table.bindRows("/");		
		},
		getOption: function(tokenValue,currLength){
		
			function returnSign(){
				return tokenValue.exclude === false ? "I" : "E";
			}
			
			function isEqual(){
				return {"Id": currLength + 1,"Attribute": tokenValue.keyField,"Sign": returnSign(), "Option": OPTION_CONST.eq(), "Low": tokenValue.value1};
			}
			
			function isContains(){
				return {"Id": currLength + 1,"Attribute": tokenValue.keyField,"Sign": returnSign(), "Option": OPTION_CONST.cp(), "Low": "*" + tokenValue.value1 + "*"};
			}
			
			function isBetween(){
				return {"Id": currLength + 1,"Attribute": tokenValue.keyField,"Sign": returnSign(), "Option": OPTION_CONST.bt(), "Low": tokenValue.value1, "High": tokenValue.value2};
			}
			
			function isEndsWith(){
				return {"Id": currLength + 1,"Attribute": tokenValue.keyField,"Sign": returnSign(), "Option": OPTION_CONST.endswith(), "Low": "*" + tokenValue.value1};
			}
			
			function isStartsWith(){
				return {"Id": currLength + 1,"Attribute": tokenValue.keyField,"Sign": returnSign(), "Option": OPTION_CONST.startswith(), "Low": tokenValue.value1 + "*"};
			}
				
		  var options = {
				  	"EQ": isEqual,
				    "Contains": isContains,
				    "BT": isBetween,
				    "EndsWith": isEndsWith,
				    "StartsWith": isStartsWith
				  };
		  return options[tokenValue.operation]();
		},
		getSign: function(value){
			if(value && value.indexOf("!(") > -1) {
				return SIGN_CONST.exclude();
			}
			
			return SIGN_CONST.include();
		},
		defaultFilters: function(settings,filters){
			for(var i = 0; i < settings.filters.length; i++) {
				settings.filters[i].Id = i + 1;
				filters.push(settings.filters[i]);
			}
		},
		basicSearchFilter: function(filters){
			var basicSearchValue = this.basicSearchField.getValue();
			var basicSearchFilter = null;
			
			if(basicSearchValue && basicSearchValue !== ""){				
				basicSearchFilter = {"Id":filters.length + 1,"Attribute":"EXT_HR_ID","Sign":SIGN_CONST.include(),"Option":OPTION_CONST.cp(),"Low":"*" + basicSearchValue + "*"};
				filters.push(basicSearchFilter);
			}			
		},
		getAttributeName: function(attributeId){
			return "ATTR#" + this.oSettings.attributeType + "#" + attributeId;
		},
		advancedSearchFilter: function(arg,filters){
			var set = arg[0].getParameter("selectionSet");			
			for(var i = 0; i < set.length; i++){
				var currentItem = set[i];
				var tokens = currentItem.getTokens();
				for(var j = 0; j < tokens.length; j++){
					var tokenWithData = tokens[j].getAggregation("customData")[0].getProperty("value");
					var item = this.getOption(tokenWithData,filters.length);					
					filters.push(item);
				}	
				
				if(currentItem.getValue()){
					var token = { exclude: false, operation: "EQ", keyField: currentItem.searchKey, value1: currentItem.getValue(), value2: "" };
					filters.push(this.getOption(token, filters.length));
				}
				
			}
		},
		getColumnModel: function(aColumns){
			var oColModel = new JSONModel();
			oColModel.setData({
				cols: aColumns
			});	
			
			return oColModel;
		},
		/**
		 * Initializes a value help dialog.
		 * 
		 * !!!!! second argument is optional and must be a function. it is used to tweek column after vhd is created.!!!!
		 */
		initCtrl: function(oSettings, columnCustomizer){
			columnCustomizer = columnCustomizer || jQuery.noop;
			
			if(!(columnCustomizer instanceof Function)){
				throw new Error("Value Help Dialog column customizer must be a function");
			}
			
			var that = this;
			this.oBus = sap.ui.getCore().getEventBus();
			this.oSettings = oSettings;
			
			var oValueHelpDialog = new HelpDialog({
				basicSearchText: oSettings.searchValue,
				title: oSettings.title,
				supportMultiselect: oSettings.supportMultiselect,
				supportRanges: oSettings.supportRanges,
				supportRangesOnly: oSettings.supportRangesOnly,				
				stretch: oSettings.stretch,				 
				cancel: function(oControlEvent) {
					that.oBus.publish("retail.pmr.promotionaloffers", "cancelProductGroup", null);
					oValueHelpDialog.close();
				},				 
				afterClose: function() {					
					oValueHelpDialog.destroy();
				}
			});
			
			if(sap.ui.version >= "1.44.0") {
				oValueHelpDialog.setEscapeHandler(function(){
					that.oBus.publish("retail.pmr.promotionaloffers", "cancelProductGroup", null);
					oValueHelpDialog.close();
				});
			}
		
			var table = oValueHelpDialog.getTable();
			var columnsModel = this.getColumnModel(oSettings.tableColumns);
			
			table.setModel(columnsModel, oSettings.oColModelBindName);
		    table.getColumns().forEach(columnCustomizer);
              
            table.getColumns().forEach(function(column, index){
            	if(index === 4){
                	column.setHAlign("End");
                    column.getLabel().setTextAlign("End");
				}
            });

			
			if (table.bindItems) { 
				var oTable = oValueHelpDialog.getTable();
				oTable.bindAggregation("items", oSettings.bindPath, function(sId, oContext) {
					var aCols = oTable.getModel("columns").getData().cols;
					return new sap.m.ColumnListItem({
						cells: aCols.map(function (column) {
							var colname = column.template;
							
							return new sap.m.Label({ text: "{" + colname + "}" });
						})
					});
				});
			}
			
			table.attachRowSelectionChange(function(oControlEvent){
				var index = oControlEvent.getParameters().rowContext.sPath.split("/")[1];
				var selectedItem = oControlEvent.getParameters().rowContext.getModel().getData()[index];
				that.selectedItem = selectedItem;
				that.oBus.publish("retail.pmr.promotionaloffers", "selectedProductGroup", {"selectedProductGroupItem":that.selectedItem});
				
				oValueHelpDialog.close();
			});
			
			var filterItems = [];
			function setSettings(ranges,title){
				var nameSettings = {						
					valueHelpRequest:function(){
						var that = this;
						var supportedRanges = [
						    sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.Contains,
	                        sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EQ,
	                        sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.BT,
	                        sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.StartsWith,
	                        sap.ui.comp.valuehelpdialog.ValueHelpRangeOperation.EndsWith						                      
	                    ];
						
						var valueHelpName = new HelpDialog({							
							supportMultiselect: true,
							supportRanges: true,
							supportRangesOnly: true,							
							title: title,
							ok: function(oControlEvent) {
								that.setTokens(oControlEvent.getParameters().tokens);
								valueHelpName.close();						
							},				 
							cancel: function(oControlEvent) {
								valueHelpName.close();
							},				 
							afterClose: function() {					
								valueHelpName.destroy();
							}
						});

						valueHelpName.setIncludeRangeOperations(supportedRanges);
						valueHelpName.setRangeKeyFields(ranges);
						valueHelpName.setTokens(that.getTokens());
						valueHelpName.open();
					}
				};
				
				return nameSettings;
			}
			
			var t = 0;
			var item = null;
			for(t = 0; t < oSettings.definedFilters.length; t++){
				item = new MultiInput(setSettings([{label:oSettings.definedFilters[t].label,key:oSettings.definedFilters[t].key}],oSettings.definedFilters[t].label));
				item.searchKey = oSettings.definedFilters[t].key;
				var group = new FilterGroupItem({ groupTitle: "Group Details", groupName: "g1", name: oSettings.definedFilters[t].key, 
												label: oSettings.definedFilters[t].label, control: item, visibleInFilterBar: true});
				filterItems.push(group);
			}
			
			var arrAttr = [];
			for(t = 0; t < oSettings.productGroupAttributes.length; t++){
				item = new MultiInput(setSettings([{label:oSettings.productGroupAttributes[t].label,key:oSettings.productGroupAttributes[t].key}],oSettings.productGroupAttributes[t].label));
				item.searchKey = "ATTR_" + oSettings.productGroupAttributes[t].type + "_" + oSettings.productGroupAttributes[t].id;
				var itemWithLabel = {multiInput: item,label:oSettings.productGroupAttributes[t].label,id:oSettings.productGroupAttributes[t].id, object : oSettings.productGroupAttributes[t].object};
				arrAttr.push(itemWithLabel);
			}
			
			for(var q = 0; q < arrAttr.length; q++){
				var itemGr = new FilterGroupItem({ 
					groupTitle: "Attributes", 
					groupName: "g2", 
					name: "attr_name_" + arrAttr[q].id + "_" + arrAttr[q].object, 
					label: arrAttr[q].label, 
					control: arrAttr[q].multiInput, 
					visibleInFilterBar: true});
				filterItems.push(itemGr);
			}

			var oFilterBar = new FilterBar({
				advancedMode: true,
				filterBarExpanded: oSettings.filterBarExpand,				
				showGoOnFB: oSettings.showGoOnFB,
				filterGroupItems: filterItems,
				search: function(event) {					
					var filters = [];
					var terms = [];
					
					//default filters
					that.defaultFilters(oSettings,filters);
					
					//add basic search filter
					that.basicSearchFilter(filters);
					
					//add default filters
					that.advancedSearchFilter(arguments,filters);
					
					var createEndpoint = oSettings.complexSearchUrl;
					var payload = that.createPayload(oSettings, terms, filters);
					table.setBusy(true);
					that.create(oSettings.service, createEndpoint, payload).then(function(responseData){
						that.bindItems(responseData,table);
						table.setBusy(false);
					});
				}
			});
		
			this.basicSearchField = new sap.m.SearchField({
				showSearchButton: sap.ui.Device.system.phone,
				placeholder: oSettings.FilterPlaceholder,
				value: oSettings.inputFilter				
			});
			
			if (oFilterBar.setBasicSearch) {
				oFilterBar.setBasicSearch(this.basicSearchField);
			}
			oFilterBar.setSearchEnabled(true);
			
			oValueHelpDialog.setFilterBar(oFilterBar);
			
			return oValueHelpDialog;
		}
	};
	
	return ValueHelpDialog;
},true);