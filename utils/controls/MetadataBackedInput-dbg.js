/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Input",
               "sap/m/InputRenderer",
               "retail/pmr/promotionaloffers/utils/Models",
               "sap/ui/comp/providers/ValueHelpProvider",
           	   "sap/ui/model/json/JSONModel",
               "sap/ui/comp/providers/ValueListProvider",
               "retail/pmr/promotionaloffers/utils/Utils"
], function(Input, InputRenderer, Models, ValueHelpProvider, JSONModel, ValueListProvider, Utils){
	
	function ValueHelpProviderWithSelectEvent(options){
		this._onItemSelected = options.onItemSelected || Utils.identity;
		ValueHelpProvider.call(this, options);
	}
	
	ValueHelpProviderWithSelectEvent.prototype = Object.create(ValueHelpProvider.prototype);
	ValueHelpProviderWithSelectEvent.prototype._onOK = function(e){
		var extendedEvent = this._onItemSelected(e);
		return ValueHelpProvider.prototype._onOK.call(this, extendedEvent || e);
	};
	
	ValueHelpProviderWithSelectEvent.prototype._rebindTable = function(){
		var table = this.oValueHelpDialog.getTable();
		this.busyTable = true;
		
		//hides guid column in value help
		if (this.sFieldName == "TargetGroup"){
			for (var i = 0; i < table.getColumns().length; i++){
				if (table.getColumns()[i].getTooltip() == "GUID"){
					table.getColumns()[i].setVisible(false);
				}
			}
		}
		
		var filterData = this.oFilterModel.getData();
		var keys = Object.keys(filterData);
		
		if(!keys.length) {
			// we don't have parameters
			ValueHelpProvider.prototype._rebindTable.call(this);
			return;
		}
		this.aSelect = this.aSelect.concat(keys);
		var that = this;
		// Attach busy state in order to add search state to table
		table.attachBusyStateChanged(function(e) {
			if(that.busyTable) {
				that.oValueHelpDialog.TableStateDataSearching();
			}
		});
		ValueHelpProvider.prototype._rebindTable.call(this);
		
		var filters = keys.map(function(key){
			return filterData[key] ? (new sap.ui.model.Filter(key, "EQ", filterData[key])) : null;
		}).filter(function(filter){
			return filter;
		});
		
	
		var itemsBinding = table.getBinding("rows");
		// Attach data received in order to add data filled state to table
		itemsBinding.attachDataReceived(function(e) {
			if(e.getParameter("data")) {
				that.busyTable = false;
				that.oValueHelpDialog.TableStateDataFilled();
			}
		});
		itemsBinding.filter(filters.concat(itemsBinding.aApplicationFilters), sap.ui.model.FilterType.Application);
	};
	
	return Input.extend("retail.pmr.promotionaloffers.utils.controls.MetadataBackedInput", {
		renderer: InputRenderer.render,
		metadata: {
			properties: {
				target: {
                    type: "string",
                    defaultValue: null 
                },
                title: {
                    type: "string",
                    defaultValue: null
                },
                parameters: {
                	type: "object",
                	defaultValue: {}
                }
			},
			events : {
				valueHelpDialogSelection : {
					parameters : {
						value : {type : "string"}
					}
				}
			}
		},
		
		init : function () {
	        // call the init function of the parent
			Input.prototype.init.apply(this, arguments);
			this.initialized = false;
		},
		
		onAfterRendering: function(oEvent) {
			Input.prototype.onAfterRendering.apply(this, arguments);
			if(this.initialized) {
				return;
			}
			this.initAnnotation();
		},
		bindAggregation: function(name, params) {
			params.path = "Annotation>" + params.path;
			Input.prototype.bindAggregation.call(this, name, params);
			
		},
		initAnnotation: function() {
			
			var target = this.getTarget();
			var fieldName = target.split("/")[1];
			var fieldTitle = this.getTitle();
			var oDataModel = Models.getServiceModel();
			var oInput = this;	
			
			this.initialized = true;
			
			Models.getMetadataAnalyzer().then(function(oMetadataAnalyzer){
				
				oInput.setFilterSuggests(false);
				oInput.setModel(oDataModel, "Annotation");

				var sAnnotationPath = Models.getNamespace(oDataModel) + target;
				var oValueListAnnotation = oMetadataAnalyzer.getValueListAnnotation(sAnnotationPath);
				oInput.keyField = oValueListAnnotation.primaryValueListAnnotation.keyField;
				var params = this.getParameters() || {};
				
				var valueHelpProvider = new ValueHelpProviderWithSelectEvent({
					onItemSelected : function(e) {
						oInput.fireValueHelpDialogSelection({
							tokens: e.getParameter("tokens")
						});
					},
					annotation : oValueListAnnotation.primaryValueListAnnotation,
					additionalAnnotations : oValueListAnnotation.additionalAnnotations,
					control : oInput,
					model : oDataModel,
					preventInitialDataFetchInValueHelpDialog : true,
					supportMultiSelect : false,
					fieldName : fieldName,
					title : fieldTitle,
					filterModel: new JSONModel(params)
				});
				
				oInput.setShowValueHelp(true);

				var valueListProvider = new ValueListProvider({
					control : oInput,
					typeAheadEnabled : true,
					aggregation : "suggestionRows",
					loadAnnotation: true,
					annotation : oValueListAnnotation.primaryValueListAnnotation,
					model : oDataModel,
					filterModel: new JSONModel(params)
				});
				// add In parameters to suggestion list
				var keys = Object.keys(params);
				if(keys.length && valueListProvider.mInParams) {
					valueListProvider.aSelect = valueListProvider.aSelect.concat(keys);
					keys.forEach(function(param){
						valueListProvider.mInParams[param] = param;
					});
				}
				
				valueListProvider._aCols.forEach(function(col){
					col.template = "Annotation>" + col.template;
				});
				oInput.setShowSuggestion(true);
			}.bind(this));
		}		
	});
});