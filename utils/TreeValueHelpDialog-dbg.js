/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
		"jquery.sap.global",
		"sap/ui/model/json/JSONModel",
		"sap/ui/comp/filterbar/FilterBar",
		"sap/m/SearchField",
		"retail/pmr/promotionaloffers/utils/HierarchyOperations",
		"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer",
		"retail/pmr/promotionaloffers/utils/Utils"
	],
	
	function(jQuery, JSONModel, FilterBar, SearchField, HierarchyOperations, 
			 ValueHelpDialogTokenizer, Utils) {
		"use strict";
		
		function _createTable(sName, oModel) {
			var oTable = sap.ui.xmlfragment(sName, {});
			oTable.setModel(oModel);
			return oTable;
		}
		
		function _reselectHierarchyNodes(tokens, table, withoutExpand, hierarchyOperations) {
			if (tokens && tokens.length > 0) {
				var valuesForReselect = hierarchyOperations.getRowSelectedIdsFromTokens(tokens);
				var rowsSelected = valuesForReselect[0];
				var pathsToExpand = valuesForReselect[1]; 
				if(table){
					hierarchyOperations.selectTreeTablesRows(table, rowsSelected, pathsToExpand, withoutExpand);
				}
			}
		}
		
		var TreeValueHelpDialog = {

				setOptions : function (options) {
					this.oOptions = options;
				},

				setHierarchyOperations: function () {
					this.oHierarchyOperations = new HierarchyOperations();
				},

				setTable: function () {
					this.oTable = _createTable(this.oOptions.tableFragment, this.oModel);
					this.oTable.attachToggleOpenState(function(e){
						_reselectHierarchyNodes(this.oTokens, this.oTable, true, this.oHierarchyOperations);
					});
				},

				setTokens: function () {
					this.oTokens = this.oOptions.tokens || [];
				},

				setModel: function () {
					this.oModel = new JSONModel({});
				},

				setBasicSearchField : function () {
					this.basicSearchField = new SearchField({
						showSearchButton: sap.ui.Device.system.phone
					});
					this.basicSearchField.attachSearch(jQuery.proxy(this.manageSearch, this));
				},

				setFilterBar: function() {
					this.oFilterBar = new FilterBar({
						advancedMode: true,
						filterBarExpanded: true,
						showGoOnFB: true
					});
					this.oFilterBar.setBasicSearch(this.basicSearchField);
					this.oFilterBar.setSearchEnabled(true);
					this.oFilterBar.attachSearch(jQuery.proxy(this.manageSearch, this));
				},

				rowSelectionChange : function(oEvent) {
					if (!this.oOptions.tokens) {
						this.oOptions.selectionChange(oEvent);
						return;
					}

					this.oValueHelpName.removeAllSelectedTokens();
					var itemsSelected = this.oOptions.selectionChange(oEvent);
					this.oTokens = itemsSelected.map( function(hierarchy) {
						return Utils.createTokenForHierarchy(hierarchy);
					});
					this.oValueHelpName.setTokens(this.oTokens);
				},

				createValueHelpName : function(reject) {
					this.oValueHelpName = new ValueHelpDialogTokenizer({
						supportMultiselect: this.oOptions.multiselect || false,
						supportRanges: this.oOptions.ranges || false,
						supportRangesOnly: this.oOptions.rangeOnly || false,
						stretch: sap.ui.Device.system.phone,
						title: this.oOptions.title,
						ok: this.oOptions.ok || function() { this.close(); },
						cancel: function() {
							this.close();
							reject();
						},
						afterClose: function() {
							this.destroy();
						},
						tokenRemove: this.oOptions.tokenRemove || jQuery.noop
					});
					
					if(sap.ui.version >= "1.44.0") {
						this.oValueHelpName.setEscapeHandler(function(){
							this.oValueHelpName.close();
							reject();
						}.bind(this));
					}
					//Set style, use compact if not provided
					this.oValueHelpName.addStyleClass(this.oOptions.styleClass || "sapUiSizeCompact");
					this.oValueHelpName.setHandleRemoveAllSelectedBtn(this.handleRemoveAllSelected.bind(this));
					this.oValueHelpName.attachSelectionChange(jQuery.proxy(this.rowSelectionChange, this));
					this.oValueHelpName.setTable(this.oTable);
					this.oValueHelpName.setFilterBar(this.oFilterBar);
					this.oValueHelpName.setModel(Utils.getI18NModel(), "i18n");
				}, 

				handleRemoveAllSelected: function(oEvent) {
					this.oTable.clearSelection();
					if (oEvent.getParameter && oEvent.getParameter("token")) {
						var token = oEvent.getParameter("token");
						if (this.oTokens && this.oTokens.length > 0) {
							for (var i = 0; i < this.oTokens.length; i++) {
								if (this.oTokens[i].getKey() === token.getKey()) {
									this.oTokens.splice(i, 1);
									break;
								}
							}
							_reselectHierarchyNodes(this.oTokens, this.oTable, true, this.oHierarchyOperations);
						}
					} else {
						this.oTokens = [];
						if (this.oOptions.tokenRemove) {
							this.oOptions.tokenRemove(null);
						}
					}

				},

				manageSearch: function(oEvent) {
					var tableFilter = Utils.uiFilter(this.oOptions.filterProps);
					var binding = this.oTable.getBinding("rows");
					var currentValue = "";
					currentValue = this.basicSearchField.getValue();			
					this.oTable.getModel().setSizeLimit(Number.MAX_VALUE); // Set the maximum returned rows on search
					if(currentValue.length > 0) {
						var combineFilters = tableFilter(currentValue);	
						binding.filter(combineFilters);
						this.oTable.expandToLevel(100);
					} else {
						binding.filter(null);
						this.oTable.expandToLevel(0);
					}
					jQuery.sap.delayedCall(0, this, function(){
						_reselectHierarchyNodes(this.oTokens, this.oTable, true, this.oHierarchyOperations);
					});	
				},

				checkExistingTokens: function () {
					//Set tokens if already provided
					if (this.oTokens.length > 0) {
						this.oValueHelpName.setTokens(this.oTokens);
					}
				},

				checkMultiSelect: function() {
					if(this.oOptions.multiselect) {
						var content = this.oValueHelpName.getContent();
						if(content.length && content[0].getItems() && content[0].getItems()[2]) {
							// this is removing the Selected Items panel (tokens) from ValueHelpDialog 
							//only if the value dialog is not for a MultiInput.
							if (!this.oOptions.tokens) {
								content[0].getItems()[2].setVisible(false);
							}	
						}					
					}
				},

				openDialog : function(options){
					this.setOptions(options);
					this.setBasicSearchField();
					this.setModel();
					this.setTable();
					this.setTokens();
					this.setFilterBar();
					this.setHierarchyOperations();
					return new Promise(function(resolve, reject){
						
						this.createValueHelpName(reject);
						this.oOptions.selectionChange = this.oOptions.selectionChange || function(e) {
							var object = e.getParameter("tableSelectionParams").rowContext.getObject();
							resolve(object);
							this.oValueHelpName.close();
						}.bind(this);
						this.checkExistingTokens();
						this.checkMultiSelect();

						//Load hierarchy
						this.oModel.setProperty("/Busy", true);
						Promise.resolve(options.values).then(function(data){
							this.oModel.setProperty("/", data);	
						}.bind(this)).then(function(){
							jQuery.sap.delayedCall(0, this, function(){
								_reselectHierarchyNodes(this.oTokens, this.oTable, false, this.oHierarchyOperations);
								this.oModel.setProperty("/Busy", false);
							});	
						}.bind(this), function(e){
							this.oModel.setProperty("/Busy", false);
							jQuery.sap.log.error(e);
						});

						//Display dialog
						this.oValueHelpName.open();
					}.bind(this));
				}
		};

		return TreeValueHelpDialog;
	}
);