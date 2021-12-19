/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define(["retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/BorderedPanel",
               "retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/BorderlessToolbar",
               "retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/Separator",
               "retail/pmr/promotionaloffers/plugins/terms/controls/freestyle/FinancialItem",
               "sap/m/Panel",
               "sap/m/PanelRenderer",
               "sap/m/Toolbar",
               "sap/m/VBox",
               "sap/m/Button",
               "sap/ui/layout/form/Form",
               "sap/ui/layout/form/FormContainer",
               "sap/ui/layout/form/FormElement",
               "sap/ui/layout/form/ResponsiveGridLayout",
               "retail/pmr/promotionaloffers/utils/Models",
               "retail/pmr/promotionaloffers/utils/Utils",
               "retail/pmr/promotionaloffers/utils/Formatter",
               "sap/m/Title",
               "sap/m/Text",
               "sap/m/Label",
               "sap/m/ObjectStatus",
               "sap/m/ObjectAttribute",
               "sap/m/ToolbarSpacer",
               "sap/ui/comp/smartvariants/SmartVariantManagement",
               "sap/ui/comp/smartvariants/PersonalizableInfo",
               "sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/ForecastDialog"
               ],
function(BorderedPanel, BorderlessToolbar, Separator, FinancialItem, Panel, PanelRenderer, Toolbar, VBox, Button, 
		Form, FormContainer, FormElement, ResponsiveGridLayout, Models, Utils, Formatter, Title, Text, Label, ObjectStatus,
		ObjectAttribute, ToolbarSpacer, SmartVariantManagement, PersonalizableInfo, JSONModel, ForecastDialog){
	"use strict";
	var formatter = {
			decimalFormatter: Utils.decimalFormatter,
			percentageFormatter: function(value) {
				return this.decimalFormatter(value) + "%";		
			},
			joinValues: function (data, properties) {
				var joined = properties.map(function(item){
					return  this.decimalFormatter(data[item]);
				}.bind(this));			
				return joined.join(" / ");
			},
			
			currencyFormatter: function (value, data) {
				var currency = data && data.Currency || "";
				return this.decimalFormatter(value) + " " + currency;
			},
			
			financialsFormatter: function (data, properties) {
				var currency = data.Currency || "";
				var firstVal = this.decimalFormatter(data[properties[0]]);
				var secondVal = this.decimalFormatter(data[properties[1]]);
				if(!firstVal && !secondVal && !currency) {
					return "";
				}
				
				return secondVal.length === 0 ? firstVal + " " + currency + " / " + secondVal : firstVal + " " + currency + " / " + secondVal + "%";
			}
	};
	
	function isLastItem(items, item){
		var currentItemIndex = items.indexOf(item);
		return currentItemIndex === (items.length - 1);
	}
	
	function createForm(elements) {
		var oModel = Models.getServiceModel();
		var oText = Utils.getResourceModel();          
		var value = elements || [];
		var formElem = value.map(function(item) {
			var aFields = [];
			
			//Generate field label
			aFields.push(
				new Text({ text: item.label, layoutData:  new sap.ui.layout.GridData({span: "L12 M12 S12"})})
				);
			
			//Generate control 
			switch (item.columnType) {
				case "Forecast":
					aFields.push(new ObjectAttribute({ 
						text: item.text, 
						active: "{= ${UIVisiblity>/Version} > 2 }",
						press: function() {
							var oKey = {
								TermId: item.id
							};
							ForecastDialog.show(ForecastDialog.Level.Term, oKey, oModel, oText);
						},
						layoutData:  new sap.ui.layout.GridData({span: "L12 M12 S12"}) }));
					break;
				case "ForecastConfidence":
					aFields.push(new ObjectStatus({ 
						text: Formatter.forecastConfidence(item.text), 
						tooltip: item.text,
						state: Formatter.forecastConfidenceState(item.text),
						layoutData:  new sap.ui.layout.GridData({span: "L12 M12 S12"}) }));
					break;
				default: 
					aFields.push(new Label({ text: item.text, layoutData:  new sap.ui.layout.GridData({span: "L12 M12 S12"}) }));
			}
			
			return new FormElement({
				fields: aFields
			});
		});
		
		return new Form({
			layout: new ResponsiveGridLayout({labelSpanL: 12, labelSpanM: 12, labelSpanS: 12}),
			formContainers: [new FormContainer({ formElements: formElem })]
		});		
	}
			
	function createVBox(value, lastItem) {
		var form = createForm(value.Items);
		var toolbar = new BorderlessToolbar({
			design: "Transparent",
			content: new Title({
				text: Utils.getResourceModel().getResourceBundle().getText("CreateOffer.Terms.FreestyleOffer.FinancialsText", [value.TermOrReward, value.Identifier])
			})
		});
		return new VBox({
			items: !lastItem ? [toolbar, form, new Separator()] : [toolbar, form]
		});
	}
	
	function createUI(items){
		return items.map(function(item, index, aItems){
			return createVBox(item, isLastItem(aItems, item));
		});
	}
	
	function createMapOfProperties(properties) {
		var oBundle = Utils.getResourceModel();
		
		//Properties derived from oData entity
		var oResult = properties.map(function(prop){
			var sFormatter = null;
			if(prop.type.indexOf("Decimal") !== -1) {
				sFormatter = "decimalFormatter";
			}
			if(prop["sap:unit"] === "Currency") {
				sFormatter = "currencyFormatter";
			}
			return {
				property : prop.name,
				label 	 : prop["sap:label"],
				visible	 : prop["sap:visible"] === "false" ? false : true,
				formatter: sFormatter
			};
			
		}).reduce(function(result, item){
			result[item.property] = item;
			return result;
		}, {});
		
		//UI specific properties
		oResult.ForecastUplift = {
			"property": "ForecastUplift",
			"label": oBundle.getProperty("ManageOffers.ProductDetails.ForecastUplift"),
			"visible": true,
			"formatter": "decimalFormatter"			
		};
		oResult.ForecastUpliftPer = {
			"property": "ForecastUpliftPer",
			"label": oBundle.getProperty("ManageOffers.ProductDetails.ForecastUpliftPer"),
			"visible": true,
			"formatter": "percentageFormatter"
		};
		
		return oResult;
	}
	
	function isVisible(columns, property){
		return columns.indexOf(property) !== -1;
	}
	
	
	function metadataItemsToFields(metaProperties, financialItems, visibleColumns){
		
		//get all the custom fields keys in a list
		var financialCustomProperties = financialItems.map(function(item){
			return item.getData().keys;
		}).reduce(function(result, props){
			return result.concat(props);
		}, []);
		
		//map the metadata properties to actual columns
		//and filter out the simple columns that are mapped by custom columns
		var fields = [];
		for(var property in metaProperties){
			if(metaProperties.hasOwnProperty(property)){
				if(financialCustomProperties.indexOf(property) === -1 &&  metaProperties[property].visible){//custom columns must not already map this key
					fields.push({
						path : property,
						text : metaProperties[property].label,
						visible : isVisible(visibleColumns, property),
						index : metaProperties[property].columnIndex
					});
				}
			}
		}
		
		return fields;
	}
	
	function financialItemsToFields(metaProperties, financialItems, visibleColumns, customIndex){
		return financialItems.map(function(item){
			var data = item.getData();
			return {
				path : data.keys.join(" - "),
				text : data.keys.map(function(key){
					return metaProperties[key].label;
				}).join(" " + data.separator + " "),
				visible : isVisible(visibleColumns, data.keys.join(" - ")),
				index: customIndex[data.keys.join(" - ")] 
			};
		});
	}
	
	function financialItemToMetaProperty(metaProperties, financialItems){
		return financialItems.reduce(function(result, item){
			var data = item.getData();
			result[data.keys.join(" - ")] = {
				label :	data.keys.map(function(key){
							return metaProperties[key].label;
						}).join(" " + data.separator + " "),
				columnIndex : data.columnIndex,
				properties : data.keys,
				separator : data.separator,
				formatter : data.formatter || "joinValues"
			};
			return result;
		}, {});
	}
	
	function createUIRepensentationOfModel(model, metaProperties, visibleColumns, financialItems){
		var financialMetaProps = financialItemToMetaProperty(metaProperties, financialItems);
		
		return model.map(function(item){
			return {
				Identifier : item.Identifier,
				TermType : item.TermType,
				TermOrReward : item.TermOrReward,
				Items : visibleColumns.map(function(column){
					var isSimpleColumn = !!metaProperties[column]; //if it's in the metadata then it's a simple column
					if(isSimpleColumn){
						var value = (item.Data || {}) [column];
						var key = (item.Data || {}) ["Id"];
						
						//Determine column type
						var columnType = "";
						if (column === "SystemForecast" && parseInt(value, 10) > 0) {
							columnType = "Forecast";
						} else if (column === "ForecastConfidence" ) {
							columnType = "ForecastConfidence";
						}
						
						return {
							label : metaProperties[column].label + ":",
							text : metaProperties[column].formatter ? formatter[metaProperties[column].formatter](value, item.Data) : value,
							id : key,
							columnType : columnType
						};	
					} else {//else it's a custom column defined in xml
						var metaItem = financialMetaProps[column];
						var label =  ( metaItem || {} ).label + ":";
						var text = "";
						if(item.Data && metaItem) {
							text = formatter[metaItem.formatter](item.Data, metaItem.properties);
						}
						return {
							label : label,
							text : text
						};
					}
					
				})
				
			};
		});
	}
	
	var SmartFinancialControl = BorderedPanel.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.SmartFinancialControl", {
		renderer: PanelRenderer.render,
		metadata: {
			properties: {
				financials: {
                    type: "any",
                    defaultValue: []
                },
                persistencyKey: {
                    type: "string",
                    group: "Misc",
                    defaultValue: null 
                },
                termFinancialItems : {
                	type : "any",
                	defaultValue : []
                }
			},
			
			aggregations : {
				 financialItems : { 
					 type : "retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.FinancialItem",
					 multiple: true,
					 singularName : "financialItem"
				}
			}
		},
		
		initialiseVariantManagement: function() {
			if(this.variantManagement && !this.variantInitialized) {
				this.variantInitialized = true;
				var financialItems = this.getFinancialItems();
				this.visibleColumns = financialItems.map(function(item){
					return item.getData().keys.join(" - ");
				});
				this.setToolbar();
				this.renderUI();
			}
		},

		init : function(){
			BorderedPanel.prototype.init.apply(this, arguments);
			this.variantManagement = new SmartVariantManagement({});
			this.variantManagement.setShowShare(true);
			var oMeta = Models.getServiceModel().getMetaModel();
			var namespace = Models.getNamespace(Models.getServiceModel());
			this.oEntity = oMeta.getODataEntityType(namespace + ".FinancialDetail");
			this.metaProperties = createMapOfProperties(this.oEntity.property);
			this.customIndex = {};
			this.visibleColumns = [];
		},
		
		setPersistencyKey: function(value, invalidate) {
			this.setProperty("persistencyKey", value, invalidate);
			var personalizableInfo = new  PersonalizableInfo({
				type: "borderedPanel",
				keyName: "persistencyKey",
				dataSource: "TODO"
			});
			personalizableInfo.setControl(this);
			this._sOwnerId = Utils.getComponent().getId();
			this.variantManagement.addPersonalizableControl(personalizableInfo);
			this.variantManagement.initialise(this.initialiseVariantManagement, this);
		},
		
		renderUI: function() {
			var that = this;
			var items = createUIRepensentationOfModel(this.getFinancials(), this.metaProperties, this.visibleColumns, this.getFinancialItems());
			that.setProperty("termFinancialItems", items);
			that.removeAllContent();
			createUI(items).forEach(function(item){
				that.addContent(item);
			});
		},
		
		
		closeFinFields: function (oEvent) {
			oEvent.getSource().close();
			oEvent.getSource().destroy();
		},
		
		okFinFields: function (oEvent) {
			oEvent.getSource().close();
			oEvent.getSource().destroy();
			var payload = oEvent.getParameter("payload").columns;
			
			if(!payload.tableItemsChanged) {
				return;
			}
			this.customIndex  = {};
			payload.tableItems.forEach(function(item){
				if(this.metaProperties[item.columnKey]){
					this.metaProperties[item.columnKey].columnIndex = item.index;
				} else {
					this.customIndex[item.columnKey] = item.index;
				}
			}.bind(this));
			this.variantManagement.currentVariantSetModified(true);
			var selections = payload.selectedItems;
			this.visibleColumns = selections.map(function(item){
				return item.columnKey;
			});
			this.renderUI();
		},
		
		addFinancialItem: function(item) {
			this.addAggregation("financialItems", item);
		},
		
		setFinancials: function(value, invalidate) {
			this.setProperty("financials", value, invalidate);
			if(value){
				this.renderUI();
			}
		},
		
		openPersonalizationDialog: function () {
			var dialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.FinFields", this);
			
			var customFields = financialItemsToFields(this.metaProperties, this.getFinancialItems(), this.visibleColumns, this.customIndex);
			var fields = metadataItemsToFields(this.metaProperties, this.getFinancialItems(), this.visibleColumns);
			
			var personalizationModel = new JSONModel({ Fields: customFields.concat(fields)});
			
			dialog.setModel(personalizationModel);
			
			dialog.open();
		},
		
		setToolbar: function() {
			var oToolbar = new Toolbar({
				height: "3rem"
			});
			oToolbar.addContent(new Title({
				text: "{i18n>CreateOffer.Terms.Freestyle.Financials}"
			}));
			oToolbar.addContent(this.variantManagement);
			oToolbar.addContent(new ToolbarSpacer());
			oToolbar.addContent(new Button({
				icon: "sap-icon://action-settings",
				press: this.openPersonalizationDialog.bind(this)
			}));
			
			this.setHeaderToolbar(oToolbar);
		},
		
		fetchVariant: function() {
			return {
				visibleColumns : this.visibleColumns
			};
		},
		
		applyVariant: function(variant) {
			this.visibleColumns = variant.visibleColumns || [];
			
			this.renderUI();
		},
		
		destroy: function() {
			Form.prototype.destroy.apply(this, arguments);
		}
	});
	return SmartFinancialControl;
});