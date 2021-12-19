/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define(["sap/ui/core/Control",
               "sap/m/SearchField",
               "sap/m/Label",
               "sap/m/Title",
               "sap/m/ComboBox",
               "sap/m/OverflowToolbar",
               "sap/m/Button",
               "sap/m/Link",
               "sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/comp/smartvariants/PersonalizableInfo",
               "sap/m/ToolbarSpacer",
               "sap/ui/comp/smartvariants/SmartVariantManagement",
               "sap/ui/model/Filter",
               "sap/ui/model/Sorter",
               "sap/ui/table/SortOrder",
               "sap/ui/table/ColumnMenu"
               ],        
function(Control, SearchField, Label, Title, ComboBox, Toolbar, Button, Link, JSONModel, Utils, PersonalizableInfo, ToolbarSpacer, SmartVariantManagement, Filter, Sorter, SortOrder, ColumnMenu){
	"use strict";
	
	var sCurrentLocale = sap.ui.getCore().getConfiguration().getLanguage();
	var oLocale = new sap.ui.core.Locale(sCurrentLocale); 
	
	var numberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
		groupingEnabled: false,
		maxFractionDigits: 2,
		emptyString : null
	}, oLocale);
	
	function getId(term) {
		var item = term.Selection;
		return item.ProductId || item.HierarchyNodeId || item.HierarchyId;
	}
	 // Float comparator
	function compareFloats(value1, value2) {
		var number1 = parseFloat(value1);
		var number2 = parseFloat(value2);
		if(isNaN(number1) && isNaN(number2)) {
			return -1;
		} 
		if (isNaN(number1) || number1 < number2) {
			return -1;
		}
		if (isNaN(number2) || number1 > number2) {
			return 1;
		}
		return 0;
	}
		
	function filterFunction(value) {
		return parseFloat(numberFormat.format(value)) === this.oValue1;
	}

	function customSort(oTable, sColumnKey, sSortOrder) {
		var i, l;
		var aColumns = oTable.getColumns();
		// get the selected column
		var oColumn = aColumns.filter(function(column) {
			return column.getSortProperty() === sColumnKey;
		})[0];
		var aSortedCols = oTable.getSortedColumns();
		
		// reset the sorting status of all columns which are not sorted anymore
		for (i = 0, l = aColumns.length; i < l; i++) {
			if (jQuery.inArray(aColumns[i], aSortedCols) < 0) {
				// column is not sorted anymore -> reset default and remove sorter
				aColumns[i].setProperty("sorted", false, true);
				aColumns[i].setProperty("sortOrder", SortOrder.Ascending, true);
				aColumns[i]._updateIcons();
				delete aColumns[i]._oSorter;
			}
		}
		// set sort on the selected column
		oColumn.setProperty("sorted", true, true);
		oColumn.setProperty("sortOrder", sSortOrder, true);
		oColumn._oSorter = new Sorter(oColumn.getSortProperty(), oColumn.getSortOrder() === SortOrder.Descending);
		
		//check for type
		var type = oColumn.getFilterType();
		if(type && type.sName === "Float") {
			oColumn._oSorter.fnCompare = compareFloats;
		}
		// add sorters of all sorted columns to one sorter-array and update sort icon rendering for sorted columns
		var aSorters = [];
		for (i = 0, l = aSortedCols.length; i < l; i++) {
			aSortedCols[i]._updateIcons();
			aSorters.push(aSortedCols[i]._oSorter);
		}
		oTable.getBinding("rows").sort(aSorters);
	}
	
	
	function customFilter(oTable, sColumnKey, sValue) {
		var aColumns = oTable.getColumns();
		// get the selected column
		var oColumn = aColumns.filter(function(column) {
			return column.getSortProperty() === sColumnKey;
		})[0];
		oColumn.setProperty("filtered", !!sValue, true);
		oColumn.setProperty("filterValue", sValue, true);
		var oMenu = oColumn.getMenu();
		if (oMenu && ColumnMenu && oMenu instanceof ColumnMenu) {
			// update column menu input field
			oMenu._setFilterValue(sValue);
		}

		var aFilters = [];
		var aCols = oTable.getColumns();
		for (var i = 0, l = aCols.length; i < l; i++) {
			var oCol = aCols[i],
				oFilter;

			oMenu = oCol.getMenu();
			try {
				oFilter = oCol._getFilter();
				if (oMenu && ColumnMenu && oMenu instanceof ColumnMenu) {
					oMenu._setFilterState("None");
				}
			} catch (e) {
				if (oMenu && ColumnMenu && oMenu instanceof ColumnMenu) {
					oMenu._setFilterState("Error");
				}
				continue;
			}
			if (oFilter) {
				var type = oCol.getFilterType();
				if(type && type.sName === "Float" && oFilter.sOperator === "EQ") {
					oFilter.fnTest = filterFunction.bind(oFilter);
				}
				aFilters.push(oFilter);
			}
		}
		
		oTable.getBinding("rows").filter(aFilters, sap.ui.model.FilterType.Application);

		oColumn._updateIcons();
		return aFilters;
	}
	
	var SmartProductDetails = Control.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.SmartProductDetails", {
		renderer: function(oRm, oControl) {
			oRm.write("<div");
			oRm.writeControlData(oControl);
			oRm.writeClasses();
			oRm.write(">");
			oRm.renderControl(oControl.getAggregation("table"));
			oRm.write("</div>");
		},

		metadata: {
			properties: {
				itemProperty: {
                    type: "string",
                    defaultValue: null
                },
                width: { type : "sap.ui.core.CSSSize" },
                filterItems : {
                	type : "string",
                	defaultValue : null
                },
                persistencyKey: {
                    type: "string",
                    group: "Misc",
                    defaultValue: null 
                },
                termFinancialItems : {
                	type : "any",
                	defaultValue : []
                },
                purposeColumns : {
                	type : "any",
                	defaultValue : []
                },
                editable : {
                	type : "boolean",
                	defaultValue : true
                },
                financialsAvailable : {
                	type : "boolean",
                	defaultValue : true
                }
			},		
			events : {
				massEditClicked : {
					selections : "array",
					selectedPaths : "array"
				},
				showMoreProductsOk : {
					selections : "object"
				},
				hideProductsConfirm : {
					selections : "array",
					selectedPaths : "array"
				},
				purposeChecked: {
					
				}
			},
			aggregations : {
				table: {
                    type: "sap.ui.table.Table",
                    multiple: false
                }
			}
		},
		
		setWidth: function(width) {
			this.setProperty("width", width);
			this.getTable().setWidth(width);
		},
		
		getTermFilters: function(defaultFilters) {
			var model = this.getModel().getData();
			var rewards = (model.Rewards || []).filter(function(item) {
				return item.isWholeOffer;
			});
			var allTermReward = (model.Terms || []).concat(rewards);
			
			var filters = allTermReward.filter(getId).map(function(term) {
				var item = term.Selection;
				var id = getId(term);
				return {
					"Attribute" : "TERM",
					"Sign" : "I",
					"Option" : "EQ",
					"Low" : item.DimensionType + "#" + Utils.base64ToHex(id)
				};
			});
			return defaultFilters.concat(filters);
		},
		
		launchSearchProductsDialog: function() {
			var that = this;
			return new Promise(function(resolve, reject) {
				var sPath = "retail.pmr.promotionaloffers.plugins.terms.controls.search.ProductSearchPage";
				var oController = sap.ui.controller(sPath);
				var oFragment = sap.ui.xmlfragment(sPath, oController);
				oFragment._sOwnerId = that.componentId;
				var i18nTitle = "ManageOffers.ProductDetails.ShowMoreProducts";
				var masterDataSystem = that.getModel("GeneralModel").getProperty("/MasterdataSystem");
				oController.getExtraFilters = that.getTermFilters.bind(that);
				oController.onInit(oFragment, masterDataSystem, null, i18nTitle, resolve, reject, true, []);
			});
		},
		
		addToolbar: function(table) {
			var that = this;
			var oToolbar = new Toolbar();
			oToolbar.addContent(new Title({
				text: {
					parts : [ {path : "i18n>CreateOffer.ProductDetails.TableTitle"},
					          {path : "i18n>CreateOffer.ProductDetails.TableTitleWithSubset"},
					          {path : "/ProductDetailsVisible/length"},
					          {path : "/ProductDetailsTotal"}],
					formatter: function(title, titleSubset, length, total){
				    	 if(length === total) {
				    		 return jQuery.sap.formatMessage(title , length);
				    	 }
				    	 return jQuery.sap.formatMessage(titleSubset , length, total);
					}
				}
			})); 
			oToolbar.addContent(this.variantManagement);
			var inputFilter = new SearchField({
				placeholder: "{i18n>ManageOffers.ProductDetails.ProductSearch}",
				liveChange: this.filterProductDetails.bind(this), 
				width: "15rem"
			});
			var labelFilter = new Label({
				text: "{i18n>ManageOffers.ProductDetails.ProductView}"
			}); 
			this.comboFilter = new ComboBox({
				selectedKey : "All Terms",
				selectionChange : function(e) {
					that.filterTable(inputFilter.getValue());
				},
				items : {
					path : this.getFilterItems(),
					template : new sap.ui.core.Item({
						key : "{Key}",
						text : "{Value}"
					})
				}
			});
			this.comboFilter.addAriaLabelledBy(labelFilter);
			
			this.massEditLink = new Link({
				text : "{i18n>ManageOffers.ProductDetails.MassEdit}",
				press:  function() {
					//Pass back indices and corresponding rows
					var selections = that.oTable.getSelectedIndices();
					var selectedPaths = selections.map( function(index) {
						return that.oTable.getContextByIndex(index).sPath;	
					});
					that.fireEvent("massEditClicked", { selections :  selections, 
														selectedPaths : selectedPaths });
				},
				enabled : false
			});
			
			this.showMoreProducts = new Link({
				text : "{i18n>ManageOffers.ProductDetails.ShowMoreProducts}",
				press: function(){
					this.launchSearchProductsDialog().then(function(productGroupItems) {
						var dimWithKeys = productGroupItems.reduce(function(result, product){
							var keys = product.Term.split("' '").map(function(term) { return term.trim(); });
							keys.forEach(function(key) {
								if(!result[key]) {
									result[key] = { Products: [] };
								}
								result[key].Products.push(product);
							});
							return result;
						}, {});
						that.fireEvent("showMoreProductsOk", { selections :  dimWithKeys });
					});
				}.bind(this),
				enabled : true,
				visible: "{= ${/ProductDetailsVisible/length} !== ${/ProductDetailsTotal} && ${UIVisiblity>/Version} > 2 && ${Content>/Editable} }"
			}).addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginEnd");
			
			this.hideProducts = new Link({
				text : "{i18n>ManageOffers.ProductDetails.Hide}",
				press: function(){
					var selections = that.oTable.getSelectedIndices();
					var selectedPaths = selections.map( function(index) {
						return that.oTable.getContextByIndex(index).sPath;	
					});
					that.fireEvent("hideProductsConfirm", { selections :  selections, selectedPaths : selectedPaths });
				},
				enabled : false,
				visible: "{=${UIVisiblity>/Version} > 2 && ${Content>/Editable} && ${featuresAvailable>/ProductSubset} === 'X'}"
			});
			oToolbar.addContent(labelFilter);
			oToolbar.addContent(this.comboFilter);
			oToolbar.addContent(new ToolbarSpacer());

			oToolbar.addContent(inputFilter);
			oToolbar.addContent(this.massEditLink);
			oToolbar.addContent(this.showMoreProducts);
			oToolbar.addContent(this.hideProducts);
			oToolbar.addContent(new Button({
				icon: "sap-icon://action-settings",
				press: this.openPersonalizationDialog.bind(this)  
			}));
			table.setToolbar(oToolbar);
		},
		
		setEditable : function(value){
			this.setProperty("editable", value);
			this.massEditLink.setVisible(value);
			
			if(value !== undefined && value !== null){
				this.oTable.setSelectionMode(value ? "MultiToggle" : "None");	
			}else{
				this.oTable.setSelectionMode("MultiToggle");	
			}
			
		},
		
		filterTable : function(searchValue) {
			//Add app. specific filters for quick search and terms
			var itemsBinding = this.oTable.getBinding("rows");
			
			//Term dropdown
			var globalFilterKey = this.comboFilter.getSelectedKey();
			if(globalFilterKey !== "All Terms" && globalFilterKey){
				this.aFilters = [new Filter("Terms", "EQ", this.comboFilter.getSelectedKey())];
			} else {
				this.aFilters = [];
			}

			//Quick search
			this.aFilters = this.aFilters.concat([new Filter([
	             new Filter("ExtProductId", "Contains", searchValue), 
	             new Filter("Name", "Contains", searchValue)]
			)]);

			itemsBinding.filter(this.aFilters.concat(this.aFilterColumns), sap.ui.model.FilterType.Application);
		},
		filterProductDetails : function(e){
			var searchValue = e.getParameter("newValue");
			this.filterTable(searchValue);
		},
		
		_storeColumnsConfig: function() {
			//Store current column config in private variable
			this.aColumns = this.oTable.getColumns().reduce(function(result, column){
				var columnKey = column.getSortProperty() || column.data("property");
				result[columnKey] =  {
					columnKey: columnKey,
					visible: column.getVisible(),
					index: column.getIndex()
				};
				if(column.getSorted()) {
					result[columnKey].sortOrder = column.getSortOrder();
				}
				if(column.getFilterValue()) {
					result[columnKey].filterValue = column.getFilterValue();
				}
				return result;
			}, {});
		},
		
		setTable: function(table) {
			if(!table) {
				return;
			}
			this.setAggregation("table", table);
			this.oTable = table;
			table.setSelectionMode("MultiToggle");
			var that = this;
			table.attachRowSelectionChange(function(e){ 
				var hasSelections = e.getSource().getSelectedIndices().length > 0;
				that.massEditLink.setEnabled(hasSelections);
				that.hideProducts.setEnabled(hasSelections);
			});

			this.addToolbar(table);
			this.aFreezeCols = table.getFixedColumnCount();
			table.attachColumnFreeze(function(oEvent) {
				var column = oEvent.getParameter("column");
				this.aFreezeCols = column.getIndex() + 1;
				this.variantManagement.currentVariantSetModified(true);	
			}.bind(this));
			
			this._storeColumnsConfig();
			this.aFilters = [];
			this.aSortItems = [{ keyField : "ExtProductId", operation : "Ascending" }];
			this.bMultiSort = false;
			
			//Update variant if user drags and drop columns
			this.oTable.attachColumnMove(function(oEvent) {
				this.variantManagement.currentVariantSetModified(true);
			}.bind(this));
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
			
			this.variantManagement.addPersonalizableControl(personalizableInfo);
			this.variantManagement.initialise(this.initialiseVariantManagement, this);
			
		},
		initialiseVariantManagement: function() {
			if(this.variantManagement && !this.variantInitialized) {
				this.variantInitialized = true;
				this.oTable.bindRows(this.getItemProperty());
			}	
		},
		
		init : function(){
			this.variantManagement = new SmartVariantManagement({});
			this.variantManagement.setShowShare(true);
			this.aSortItems = [];
			this.aFilterColumns = [];
		}
	});
	
	SmartProductDetails.prototype.fetchVariant = function() {
		this._storeColumnsConfig();
		return {
			columns : jQuery.extend(true, {}, this.aColumns),
			freezeIndex: this.aFreezeCols,
			sortItems: this.aSortItems,
			multiSort: this.bMultiSort
		};
	};
	
	SmartProductDetails.prototype.filterColumn = function(oEvent) {
		var column = oEvent.getParameter("column");
		var value = oEvent.getParameter("value");
		var columnKey = column.getSortProperty();
		this.aColumns[columnKey].filterValue = value;
		this.variantManagement.currentVariantSetModified(true);
		oEvent.bPreventDefault = true;
		this.aFilterColumns = customFilter(this.oTable, columnKey, oEvent.getParameter("value")) || [];
	};
	
	SmartProductDetails.prototype.sortColumn = function(oEvent) {
		var column = oEvent.getParameter("column");
		var sortOrder = oEvent.getParameter("sortOrder");
		var columnKey = column.getSortProperty();
		// clear columns of sort
		Object.keys(this.aColumns).forEach(function(property) {
			delete this.aColumns[property].sortOrder;
		}.bind(this));
		// set sort order
		this.aColumns[columnKey].sortOrder = sortOrder;
		this.variantManagement.currentVariantSetModified(true);
		oEvent.bPreventDefault = true;
		this.aSortItems = [{ keyField : columnKey, operation : oEvent.getParameter("sortOrder")}];
		this.bMultiSort = false;
		customSort(this.oTable, columnKey, oEvent.getParameter("sortOrder"));
	};
		
	SmartProductDetails.prototype.reset = function(columns) {
        this.aColumns = columns || {};
        var allCols = this.oTable.getColumns();
        var customCols = [];
        this.oTable.removeAllColumns();
        var filterVal;
        var aSorter = [];
        this.aFilterColumns = [];
        var oSort = this.aSortItems.reduce(function(result, sort){
        	result[sort.keyField] = sort.operation;
        	aSorter.push(new Sorter(sort.keyField, sort.operation === "Descending"));
        	return result;
        }, {});
        
        for(var i = 0, iLen = allCols.length; i < iLen; i++) {
            var currentColumn = allCols[i]; 
            var property = currentColumn.getSortProperty() || currentColumn.data("property");
            if(this.aColumns.hasOwnProperty(property)) {
                
            	currentColumn.setVisible(this.aColumns[property].visible);
                this.oTable.insertColumn(currentColumn, this.aColumns[property].index);
                
                currentColumn.setSorted(false);
	        	if(oSort.hasOwnProperty(property)) {
	        		currentColumn.setSorted(true);
	        		currentColumn.setSortOrder(oSort[property]);
	            }
	        	filterVal = this.aColumns[property].filterValue;
            	currentColumn.setFiltered(!!filterVal);
            	currentColumn.setFilterValue(filterVal || "");
            	if(!!filterVal) {
            		this.aFilterColumns.push(currentColumn._getFilter());
            	}
	            
            } else if (currentColumn.getSortProperty().indexOf("_PURPOSE_") === -1) {
                currentColumn.setVisible(false);
                customCols.push(currentColumn);
            }
        }
        
        // add the extended columns at the end of table
        customCols.forEach(function(column) {
            var index = this.oTable.getColumns().length;
            this.oTable.insertColumn(column, index);
        }.bind(this));
        
        this.addPurposesDynamically(false);
      
        //Bind table only once
        this.oTable.bindRows({
            path: this.getItemProperty(),
            filters: this.aFilters.concat(this.aFilterColumns),
            sorter: aSorter
        });
        
        this.variantManagement.currentVariantSetModified(false);
	};
	
	SmartProductDetails.prototype.endsWith = function(id, value) {
		return id.indexOf(value, id.length - value.length) !== -1;
	};
	
	SmartProductDetails.prototype.applyVariant = function(variant) {
		//Backward compatibility for variants
		var oColumns = {};
		this.aSortItems = variant.sortItems || [];
		this.bMultiSort = !!variant.multiSort;
		if (jQuery.isArray(variant.columns)) {
			variant.columns.forEach(function(oCol) {oColumns[oCol.columnKey] = oCol; });
		} else {
			oColumns = variant.columns;
		}
		
		this.reset(oColumns);
		this.getTable().setFixedColumnCount(variant.freezeIndex);
	};
	
	SmartProductDetails.prototype.openPersonalizationDialog = function () {
		var financialsAvailable = this.getFinancialsAvailable();
		var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.ProductDetailsPers", this);
		var schemaVersion = this.getModel("UIVisiblity").getProperty("/Version");
		var that = this;
		var aFields = this.oTable.getColumns().filter(function(field) {
			var isFinancialColumn = field.data("financialColumn") === "true";
			
			if(isFinancialColumn){
				return financialsAvailable;
			}
			if ( (schemaVersion <= 3 && field.getFilterProperty() === 'PromoCostPriceCurrency') ||
			     (schemaVersion <= 4 && field.getFilterProperty() === 'Visibility') )
			 {
				return false;
			 }
			return true;
		}).map(function(column) {
			return {
				path: column.getSortProperty() || column.data("property"),
				text: column.getLabel().getText(),
				visible: column.getVisible(),
				index: column.getIndex()
			};
		});
		
		var personalizationModel = new JSONModel({ 
			Fields: aFields,
			SortItems: jQuery.extend(true, {}, this.aSortItems)
		});
		
		dialog.setModel(Utils.getI18NModel(), "i18n");
		dialog.setModel(personalizationModel);
		dialog.open();
	};
	
	SmartProductDetails.prototype.closeFinFields = function(oEvent) {
		oEvent.getSource().close();
		oEvent.getSource().destroy();
	};
	
	SmartProductDetails.prototype.okFinFields = function(oEvent) {
		var columns = oEvent.getParameter("payload").columns;
		var p = oEvent.getSource();
		var sortPanel = p.getPanels()[1];
		var conditions = sortPanel._getConditions();
		this.closeFinFields(oEvent);
		var newSort = conditions.map(function(cond) {
			return {
				keyField: cond.keyField,
				operation: cond.operation
			};
		});
		this.bMultiSort = !jQuery.sap.equal(this.aSortItems, newSort);
		if(!columns.tableItemsChanged && !this.bMultiSort) {
			return;
		}
		var tableItems = (columns.tableItems || []).reduce(function(result, col, i){
			if(this.aColumns[col.columnKey]) {
				col.filterValue = this.aColumns[col.columnKey].filterValue;
				col.sortOrder = this.aColumns[col.columnKey].sortOrder;
			}
			col.index = col.index || i;
			result[col.columnKey] = col;
			return result;
		}.bind(this), {});	
		this.aSortItems = newSort;
		this.reset(tableItems);
		this.variantManagement.currentVariantSetModified(true);
	};
	
	SmartProductDetails.prototype.removeAllPurposeColumns = function() {
		
		var table = this.getTable();
		table.getColumns().filter(function(column) {
			return column.getSortProperty().indexOf("_PURPOSE_") !== -1;
		}).forEach(function(col){
			var prop = col.getSortProperty();
			table.removeColumn(col);
			if(this.aColumns.hasOwnProperty(prop)) {
				delete this.aColumns[prop];
			}
		}.bind(this));
		
	};
	
	SmartProductDetails.prototype.addPurposesDynamically = function(visible) {
		
		var purposes = this.getPurposeColumns();
		var table = this.getTable();
		var that = this;
		
		var createColumnForPurpose = function(col) {
			var newColumn = new sap.ui.table.Column({
	            label: new sap.m.Label({text: col.Name}),
	            hAlign: "Center",
	            visible: visible,
	           filterType: "sap.ui.model.type.Boolean",
	            filterProperty: "_PURPOSE_" + col.Id,
	            sortProperty: "_PURPOSE_" + col.Id,
	            template: new sap.m.CheckBox({
	            	enabled:"{Content>/Editable}",
	            	selected:"{_PURPOSE_" + col.Id + "}",
	            	name:"_PURPOSE_" + col.Id,
	            	select: function(e){
	            		var source = e.getSource();
	            		that.fireEvent("purposeChecked", {
	            			object: source.getBindingContext().getObject(),
	            			name: source.getName(),
	            			selected: source.getSelected()
	            		});
	            	}
	            })
	        });
			table.addColumn(newColumn);
			var columnKey =  "_PURPOSE_" + col.Id;
			that.aColumns[columnKey] = {
				columnKey: columnKey,
				visible: visible,
				index: newColumn.getIndex()
			};
		};
		
		purposes.forEach(function(purpose) {
			var id = "_PURPOSE_" + purpose.Id;
			if(!that.aColumns.hasOwnProperty(id)) {
				createColumnForPurpose(purpose);
			}
		});
		
	};
	
	SmartProductDetails.prototype.setPurposeColumns = function(value, invalidate) {
		if(!value || !value.length) {
			return;
		}
		this.removeAllPurposeColumns();
		if(value[0].Id) {
			this.setProperty("purposeColumns", value, invalidate);
			this.addPurposesDynamically(true);
		}
	};
	
	return SmartProductDetails;
});