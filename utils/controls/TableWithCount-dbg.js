/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Table",
               "sap/m/TableRenderer",
               "retail/pmr/promotionaloffers/utils/Models",
               "sap/m/Toolbar",
               "sap/m/Button",
               "sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/comp/smartvariants/PersonalizableInfo",
               "sap/m/ToolbarSpacer",
               "sap/ui/comp/smartvariants/SmartVariantManagement",
               "sap/m/Column",
               "sap/m/Label",
               "sap/m/Text",
               "sap/m/ColumnListItem",
               "sap/m/BusyIndicator"
               ], 
    function(Table, TableRenderer, Models, Toolbar, Button, JSONModel, Utils, PersonalizableInfo, 
            ToolbarSpacer, SmartVariantManagement, Column, Label, Text, ColumnListItem, BusyIndicator){
	return Table.extend("retail.pmr.promotionaloffers.utils.controls.TableWithCount", {
		renderer:TableRenderer.render,
		metadata: {
			properties: {
				persistencyKey: {
                    type: "string",
                    group: "Misc",
                    defaultValue: null 
                },
                itemProperty: {
                    type: "string",
                    defaultValue: null
                },
                toolbarLoadingIndicator : {
                	type : "boolean",
                	defaultValue : false
                }
			},
			aggregations : {
				 columns : { 
					 type : "sap.m.Column",
					 multiple: true,
					 singularName : "column"
				},
				template : { 
					type: "sap.m.ColumnListItem",
                    multiple: false,
                    singularName: "item"
				}			
			}
		},
		
		initialiseVariantManagement: function() {
			if(this.variantManagement && !this.variantInitialized) {
				this.variantInitialized = true;
				this.addToolbar();
				this.defaultCols = this.getColumns();
				this.defaultCells = this.getTemplate().getCells();
				this.bindItems(this.getItemProperty(), this.getTemplate());
				this.addColumnsFromMetadata();
			}
		},
		init : function () {
	        // call the init function of the parent
			Table.prototype.init.apply(this, arguments);
			this.busyIndicator = new BusyIndicator({
				visible : this.getToolbarLoadingIndicator()
			});
			this.maxCount = 0;
			var ignoreFromPersonalisation = ["SalesUom", "DistributionChannel", "SalesOrg", "Id"];
			this.variantManagement = new SmartVariantManagement({});
			var oMeta = Models.getServiceModel().getMetaModel();
			var namespace = Models.getNamespace(Models.getServiceModel());
			this.oEntity = oMeta.getODataEntityType(namespace + ".ProductDetail");
			this.metaProperties = [];
			this.oEntity.property.forEach(function(prop){
				if( prop.name.indexOf("AT_") === -1 && ignoreFromPersonalisation.indexOf(prop.name) === -1 ) {
					this.metaProperties.push({
						property : prop.name,
						label 	 : prop["sap:label"],
						visible	 : prop["sap:visible"] === "false" ? false : true
					});
				}
				
			}.bind(this));
		},
		setToolbarLoadingIndicator : function(value){
			this.setProperty("toolbarLoadingIndicator", !!value);
			this.busyIndicator.setVisible(!!value);
		},
		getColsFromMeta: function() {
			var oColumnListItem = new ColumnListItem();
			
			 this.defaultCells.forEach(function(cel){
			 	oColumnListItem.addCell(cel);
			 });
			 var columns = this.defaultCols.map(function(col, index){
				col.setOrder(index);
				return col;
			});
			function notInTable(item) {
				for(var i = 0, iLen = columns.length; i < iLen; i++) {
					if(columns[i].data("cellData") === item.property) {
						if(!columns[i].getHeader()) {
							columns[i].setHeader(new Text({
				                text : item.label
				            }));
						}		
						columns[i].setVisible(true);				
						return false;
					}
				}
				return true;
			}
			
			var colls = [];
			this.metaProperties.map(function(prop, index){
				if(notInTable(prop) && prop.visible) {
					colls.push(new Column({
						header : new Label({
			                text : prop.label
			            }),
			            minScreenWidth: "Tablet",
			            demandPopin: true,
			            visible: false
					}).data("cellData",  prop.property));
					oColumnListItem.addCell(new Text({
						 text : "{Data>ProductDetail/" + prop.property + "}"
					}));
				}				
			});
			
			return {
				list: oColumnListItem,
				columns: columns.concat(colls)
			};			
		},
		addColumnsFromMetadata: function(){
			this.removeAllColumns();
			 var data = this.getColsFromMeta();
			 data.columns.forEach(function(col) {
			 	this.addColumn(col);
			 }.bind(this));
			
			 this.bindItems(this.getItemProperty(), data.list);
		},
		
		addToolbar: function() {
			var oToolbar = new Toolbar();
			oToolbar.addContent(this.variantManagement);
			oToolbar.addContent(new ToolbarSpacer());
			oToolbar.addContent(this.busyIndicator);
			oToolbar.addContent(new Button({
				icon: "sap-icon://action-settings",
				press:  this.openPersonalizationDialog.bind(this)
			}));
			this.setHeaderToolbar(oToolbar);
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
		
		openPersonalizationDialog: function () {
			var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.FinFields", this);
			
			var aFields = this.getColumns().map(function(column){
				return {
					path: column.data("cellData"),
					text: column.getHeader().getText(),
					visible: column.getVisible(),
					index: (column.getOrder()) ? (column.getOrder()) : -1
				};
			});
			var personalizationModel = new JSONModel(
				{ 
					Fields: aFields
				});
			
			dialog.setModel(personalizationModel);
			dialog.open();
		},
		closeFinFields: function(oEvent) {
			oEvent.getSource().close();
			oEvent.getSource().destroy();
		},
		
		okFinFields: function(oEvent) {
			var columns = oEvent.getParameter("payload").columns;
			this.closeFinFields(oEvent);
			if(!columns.tableItemsChanged) {
				return;
			}
			this.variantManagement.currentVariantSetModified(true);
			this.rebuildTable(columns.tableItems);
		},
		
		rebuildTable: function(columns) {
			this.aColumns = columns || [];
			var allCols = this.getColumns();
			var tableCols = [];
			this.removeAllColumns();
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
			tableCols.forEach(this.addColumn, this);
		},
		
		setMaxCount: function (count) {
			this.maxCount = count;
		},
		
		resetGrowing: function() {
			this._oGrowingDelegate.reset();
		},
		
		getMaxItemsCount: function() {
			return this.maxCount;
		},
		fetchVariant: function() {
			return {
				columns : this.aColumns
			};
		},
		
		applyVariant: function(variant) {
			if(!variant.columns) {
				this.removeAllColumns();
				 var x = this.getColsFromMeta();
				 x.columns.forEach(function(col) {
				 	this.addColumn(col);
				 }.bind(this));
				
				 this.bindItems(this.getItemProperty(), x.list);
			} else {
				this.rebuildTable(variant.columns);
			}
			
		}
		
	});
});