/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define(["sap/m/FlexBox",
               "sap/m/Input",
               "sap/m/ComboBox",
               "sap/m/Toolbar",
               "sap/m/Button",
               "sap/m/VBoxRenderer",
               "sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/comp/smartvariants/PersonalizableInfo",
               "sap/m/ToolbarSpacer",
               "sap/ui/comp/smartvariants/SmartVariantManagement",
               "sap/ui/model/Filter"
               ],
function(FlexBox, Input, ComboBox, Toolbar, Button, FlexBoxRenderer, JSONModel, Utils, PersonalizableInfo, ToolbarSpacer, SmartVariantManagement, Filter){
	"use strict";
	
	var SmartProducts = FlexBox.extend("retail.pmr.promotionaloffers.plugins.productGroup.controls.SmartProducts", {
		renderer: FlexBoxRenderer.render,
		metadata: {
			properties: {
				itemProperty: {
                    type: "string",
                    defaultValue: null
                },
                persistencyKey: {
                    type: "string",
                    group: "Misc",
                    defaultValue: null 
                }
			},			
			aggregations : {
				table: {
                    type: "sap.m.Table",
                    multiple: false
                }
			},
			events : {
				rebindTable : {}
			}
		},
		addToolbar: function(table) {
			var oToolbar = table.getHeaderToolbar();
			oToolbar.insertContent(this.variantManagement, 1);	
			oToolbar.addContent(new Button({
				icon: "sap-icon://action-settings",
				press: this.openPersonalizationDialog.bind(this)
			}));
			table.setHeaderToolbar(oToolbar);
		},
		
		onAfterRendering : function(){
			var domRef = this.getDomRef();
			jQuery("div.sapMFlexItem", domRef).first().css("width", "100%");
		},
		
		setTable: function(table) {
			if(!table) {
				return;
			}
			this.setAggregation("table", table);
			this.oTable = table;
			this.addToolbar(table);
			
			this.aColumns = this.oTable.getColumns().map(function(column){
				return {
					columnKey: column.data("cellData"),
					visible: column.getVisible(),
					index: column.getOrder()
				};
			});
			
			this.aSortItems = [{ keyField : "ExtId", operation : "Ascending" }];
			this.aFilters = [];
			this.addItem(table);
		},
		
		setPersistencyKey: function(value, invalidate) {
			this.setProperty("persistencyKey", value, invalidate);
			var personalizableInfo = new  PersonalizableInfo({
				type: "Control",
				keyName: "persistencyKey",
				dataSource: "TODO"
			});
			this._sOwnerId = Utils.getComponent().getId();
			personalizableInfo.setControl(this);
			
			if (this.variantManagement) {
				this.variantManagement.addPersonalizableControl(personalizableInfo);
				this.variantManagement.initialise(this.initialiseVariantManagement, this);
			}
			
			
		},
		
		initialiseVariantManagement: function() {
			if(this.variantManagement && !this.variantInitialized) {
				this.variantInitialized = true;
				this.defaultCols = this.oTable.getColumns().map(function(column){
					return {
						columnKey: column.data("cellData"),
						text: column.getHeader().getText(),
						visible: column.getVisible(),
						index: column.getOrder()
					};	
				});
			}
		},
		
		init : function(){
			this.standardSort = [];
			this.standardSort.push({keyField: "ExtId", operation: "Ascending"});
			FlexBox.prototype.init.apply(this, arguments);
			this.variantManagement = new SmartVariantManagement({});
			this.variantManagement.setShowShare(true);
		}
	});
	
	SmartProducts.prototype.fetchVariant = function() {
		return {
			columns : this.aColumns,
			sortItems: this.aSortItems
		};
	};
	
	SmartProducts.prototype.applyVariant = function(variant) {
		if(!variant.columns) {
			variant.columns = this.defaultCols;	
		}
		this.rebuildTable(variant.columns, variant.sortItems || this.standardSort);	
	};
	
	SmartProducts.prototype.openPersonalizationDialog = function () {
		var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.ProductsPers", this);
		
		var aFields = this.oTable.getColumns().map(function(column){
			return {
				columnKey: column.data("cellData"),
				text: column.getHeader().getText(),
				visible: column.getVisible(),
				index: column.getOrder()
			};
		});
		var personalizationModel = new JSONModel(
			{ 
				Fields: aFields,
				SortItems: this.aSortItems
			});
		
		dialog.setModel(Utils.getI18NModel(), "i18n");
		dialog.setModel(personalizationModel);
		dialog.open();
	};
	
	SmartProducts.prototype.closeProductFields = function(oEvent) {
		oEvent.getSource().close();
		oEvent.getSource().destroy();
	};
	
	SmartProducts.prototype.okProductFields = function(oEvent) {
		var columns = oEvent.getParameter("payload").columns;
		var p = oEvent.getSource();
		var sortPanel = p.getPanels()[1];
		var conditions = sortPanel._getConditions();
		this.closeProductFields(oEvent);
		
		this.aSortItems = conditions;
		this.variantManagement.currentVariantSetModified(true);
		
		// Set index for de-selected columns to a number --> Otherwise it is undefined which will cause an error on reopen
		var aColumnsUndefinedIndex = [];
		var aTableItems = columns.tableItems;
		var iHighestIndex = 0;
		for(var i = 0; i < aTableItems.length; i++){
			if (aTableItems[i].index == undefined){
				// gather all items with undefined
				aColumnsUndefinedIndex.push(aTableItems[i]);
			}else if(aTableItems[i].index > iHighestIndex){
				// determine highest index
				iHighestIndex = aTableItems[i].index;
			}
		}
		if(aColumnsUndefinedIndex.length > 0){
			// set index
			for(i = 0; i < aColumnsUndefinedIndex.length; i++){
				aColumnsUndefinedIndex[i].index = ++iHighestIndex;
			}
		}
		
		this.rebuildTable(columns.tableItems);
	};
	
	SmartProducts.prototype.rebuildTable = function(columns, variantSortItems) {
		this.aColumns = columns || [];
		var allCols = this.oTable.getColumns();
		var tableCols = [];
		this.oTable.removeAllColumns();
		for(var i = 0, iLen = allCols.length; i < iLen; i++) {
			for(var j = 0, jLen = this.aColumns.length; j < jLen; j++) {
				if(allCols[i].data("cellData") === this.aColumns[j].columnKey) {
					allCols[i].setVisible(this.aColumns[j].visible);
					allCols[i].setOrder(this.aColumns[j].index);
					tableCols.push(allCols[i]);
					break;
				}
			}
		}		
		tableCols.forEach(this.oTable.addColumn, this.oTable);
		var oBinding = this.oTable.getBinding("items");	
		if (variantSortItems) {
			this.aSortItems = variantSortItems;
		}
		var aSorters = [];
		( this.aSortItems || [] ).forEach(function(cond) {
			var path = cond.keyField;
			var bDescending = cond.operation === "Descending";
			aSorters.push(new sap.ui.model.Sorter(path, bDescending));
		});
		this.oTable.setGrowingThreshold(this.oTable.getItems().length);
		if(this.oTable._oGrowingDelegate) {
			this.oTable._oGrowingDelegate.reset();
		}
		oBinding.sort(aSorters);
		this.oTable.setGrowingThreshold(20);
		this.fireRebindTable();
	};
	return SmartProducts;
});