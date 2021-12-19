/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
       		"sap/ui/comp/valuehelpdialog/ValueHelpDialog"
    	], function(ValueHelpDialog) {
	"use strict";
	
	function HierarchyOperations() {
	}
	
	HierarchyOperations.prototype.selectTreeTablesRows = function(treeTable, rowsSelected, pathsToExpand, withoutExpand) {
		var index = 0;
		treeTable.clearSelection();
		if (!withoutExpand) {
			pathsToExpand.forEach(function(path) {
				this.expandTreeTableByPath(treeTable, path);
			}.bind(this));
		}
	 do {
	       var context = treeTable.getContextByIndex(index);
	       if (!context) {
	    	   continue;
	       }
	       var object = context.getObject();
	      if (this.itemByIdExistsInArray(object.Id, rowsSelected)) {
	    	treeTable.addSelectionInterval(index, index);
	    	this.refreshTreeTable(treeTable);
	      }
	       index++;
	   } while (context);
	};
	
	HierarchyOperations.prototype.expandTreeTableByPath = function(treeTable, path) {
    	 var pathArray = [];
    	 pathArray = path.split("/");
    	 pathArray.shift();
    	 if (pathArray.length > 1) {
    		 pathArray.pop();
    	 }
    	 var newPath = "";
    	 for(var i = 0; i < pathArray.length; i++) {	
    		 newPath += "/" + pathArray[i];
    			 var index = this.getIndexByPath(treeTable, newPath);
    			 if (index !== -1) {
    				 treeTable.expand(index);
    				 this.refreshTreeTable(treeTable);
    			 }
    			 
     		  		
    	 }	
     };
     
     HierarchyOperations.prototype.getIndexByPath = function(treeTable, path) {
	    var result = -1;
	    var index = 0;
	    do {   
	      var context = treeTable.getContextByIndex(index);
	      if (context && context.sPath === path) {
	        result = index;
	        break;
	      }
	      index++;
	    } while (context);
	    return result;
	 };
	
	 HierarchyOperations.prototype.itemByIdExistsInArray = function(currentId, array) {
		return array.some(function(idSelected) {
			return idSelected === currentId;
		});		
	};
	
	HierarchyOperations.prototype.refreshTreeTable = function(treeTable) {
		 treeTable.refreshRows(true);
	     treeTable.getModel().refresh(true);
	};
	
	HierarchyOperations.prototype.getRowSelectedIdsFromTokens = function(tokens) {
		var idsToReturn = [];
		var pathsToExpand = [];
		(tokens || []).forEach(function(token) {
			if (token) {
				if (token.getKey()) {
					idsToReturn.push(token.getKey());
				}
				var currentPath = token.getCustomData()[0].getValue().currentPath;
				if (currentPath) {
					 var pathArray = currentPath.split("/");
			    	 pathArray.shift();
			    	 if (pathArray.length > 1) {
			    		 pathsToExpand.push(currentPath);
			    	 }	 
				}			
			}
		});
		return [idsToReturn, pathsToExpand];
	};
	
	HierarchyOperations.prototype.HierarhyFilterValueHelpDialog = function (options){
		return new Promise(function(resolve, reject){	
			var ok = function(e){
				valueHelpName.close();
			};
			var valueHelpName = new  ValueHelpDialog({		
				supportMultiselect: options.supportMultiselect || false,
				supportRanges: true,
				supportRangesOnly: true,
				stretch: sap.ui.Device.system.phone,
				title: options.title,
				displayFormat: "UpperCase",
				enableMultiLineMode: false,
				ok: options.ok || ok,
				cancel: function() {
					valueHelpName.close();
				},
				afterClose: function() {
					valueHelpName.destroy();
				}
				
			});
			valueHelpName.addStyleClass("sapUiSizeCompact");
			valueHelpName.setRangeKeyFields([{key: "ExtHierarchyId", label: options.title}]);
			if (options.tokens) {
				valueHelpName.setTokens(options.tokens);
			}
			valueHelpName.open();
		});
	};
	
	// returns a array with tokens
	HierarchyOperations.prototype.createTokensTypeConditionsFromText = function(currentTokens, text) {
		var arrayToReturn = currentTokens;
		var arrayOfHierarchiesFromText = [];
		arrayOfHierarchiesFromText = text.split(";");
		if (!text || !arrayOfHierarchiesFromText || arrayOfHierarchiesFromText.length < 1 ) {
			return arrayToReturn;
		}
		var index = arrayOfHierarchiesFromText.length;
		arrayOfHierarchiesFromText.forEach(function(item){
			var token = new sap.m.Token({text: "=" + item, key: "range_" + index});
			var obj = {
					exclude: false,
					keyField: "ExtHierarchyId",
					operation: "EQ",
					value1: item,
					value2: ""
			};
			token.addCustomData(new sap.ui.core.CustomData({key: "range", value: obj}));
			arrayToReturn.push(token);
			index++;
		});
		return arrayToReturn;
	};
	
	return HierarchyOperations;
}, /* bExport= */ true);