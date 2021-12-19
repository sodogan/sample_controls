/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
		"jquery.sap.global",
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Models",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/Constants",
		"sap/ui/core/message/Message"
	], function(jQuery, Controller, JSONModel, Models, Utils, Constants, Message) {
	"use strict";

	var check = function (attr, prop) {
		return attr[prop] && !!attr[prop].trim();
	};
	
	var getTarget = function (index, path) {
		return "/Attributes/" + index + path;
	};
	
	var findDuplicates = function (data) {
	  return data.some(function(element, index) {
		  return (data.indexOf(element, index + 1) > -1); 		     
	  });
	};
	
	function getIndexFromEvent(oEvent) {
		return oEvent.getSource().getParent().getBindingContext().getPath().split("/")[2];
	}
	
	function uniqueArray(aItems) {
		var a = [], l = aItems.length;
	    	for(var i = 0; i < l; i++) {
	    		for(var j = i + 1; j < l; j++) {
	    			if (aItems[i].AttributeType === aItems[j].AttributeType) {
	    				j = ++i;
	    			}
	    		}
	    		a.push(aItems[i]);
	    	}
	    return a;
	}
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.Attributes", {
		onInit : function() {
			this.contentModel = new JSONModel();
			this.oModel = new JSONModel({
				Attributes: []
			});
			
			this.oMessageManager = Utils.getMessageManager();
			this.oBus = sap.ui.getCore().getEventBus();			
			this.oAttributeValues = {};
			this.i18nModel = Utils.getI18NModel();
			
			this.getView().setModel(this.i18nModel, "i18n");
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.oModel);
			
			
		},
		
		openAttributeImageDialog: function(oEvent) {
			if(!this._valueHelpDialog) {
				this._valueHelpDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.plugins.AttributeImageDialog", this);
				this._valueHelpDialog.setModel(this.i18nModel, "i18n");
				this._valueHelpDialog.setModel(Models.getServiceModel());
				this.getView().addDependent(this._valueHelpDialog);
				this.oImagesTable = sap.ui.getCore().byId("imagesTable");
			}
			this.indexRow = getIndexFromEvent(oEvent);
			this._valueHelpDialog.open();
		},
		
		closeAttributeImageDialog: function() {
			this._valueHelpDialog.close();
		},
		
		selectRow: function (oEvent) {
			var oSelectedListItem = oEvent.getParameter("listItem");
			var oBindingContext = oSelectedListItem.getBindingContext();
			var oPath = oBindingContext.getPath();      
			var data = oBindingContext.oModel.getProperty(oPath);
			this.oImagesTable.removeSelections();
			this.oModel.setProperty("/Attributes/" + this.indexRow + "/AttributeImageUrl", data.Url);
			this.oModel.setProperty("/Attributes/" + this.indexRow + "/AttributeImageName", data.Name);
			this.oModel.setProperty("/Attributes/" + this.indexRow + "/AttributeValue", Utils.base64ToHex(data.Id));
			this._valueHelpDialog.close();
		},
		
		handleImageChangePress: function(oEvent) {
			this.indexRow = getIndexFromEvent(oEvent);
			this.oModel.setProperty("/Attributes/" + this.indexRow + "/AttributeValue", "");
			this.validateForm();
		},

		setAttributeStructure: function(staticData) {
			var allTypes = this.aTypeDesc;
			this.oAttributeStructure = staticData.AttributeSet.reduce(function(result, attr){
				if(!result[attr.AttributeType]) {
					result[attr.AttributeType] = {
						AttributeTypes: allTypes,
						AttributeTypeDescriptions: [], 
						AttributeTypeSelKey: attr.AttributeType,
						AttributeTypeDescSelKey: "",
						AttributeValue: "",
						AttributeLanguageSelKey: "",
						AttributeLanguageSet: attr.AttributeType === "01" || attr.AttributeType === "02" ? staticData.LanguageSet : []
					};
				}
				result[attr.AttributeType].AttributeTypeDescriptions.push({
					AttributeId: attr.AttributeId, 
					AttributeDesc: attr.AttributeDesc
				});
				return result;
			}, {});
			// add empty attribute
			this.oAttributeStructure[""] = {
				AttributeTypes: allTypes,
				AttributeTypeDescriptions: [], 
				AttributeTypeSelKey: "",
				AttributeTypeDescSelKey: "",
				AttributeValue: "",
				AttributeLanguageSelKey: "",
				AttributeLanguageSet: []
			};
		},

		/**
		 * Fired when add button is pressed to add a new line to the attributes
		 * table.
		 * 
		 * @returns {void}
		 */
		handleAddPress : function() {
			var firstAttr = Object.keys(this.oAttributeStructure).shift() || "";
			var selAttr = this.oAttributeStructure[firstAttr];
			var oNewItem = jQuery.extend(true, {}, selAttr, {
				AttributeTypeDescSelKey: ( selAttr.AttributeTypeDescriptions[0] || {} ).AttributeId,
				AttributeLanguageSelKey: selAttr.AttributeLanguageSet.length ? "EN" : ""
			});
			this.oModel.getData().Attributes.push(oNewItem);
			this.oModel.updateBindings();
			this.setListAttributeValues(this.oModel.getData().Attributes.length - 1);
		},
								
		/**
		 * Fired when delete button is pressed to remove a line from the
		 * attributes table.
		 * 
		 * @param {object} oEvent The event object.
		 * @returns {void}
		 */
		handleDeletePress : function(oEvent) {
			var aAttributes = this.oModel.getProperty("/Attributes");	
			var sPath = oEvent.getParameter("listItem").getBindingContext().getPath();
			var aTemp = sPath.split("/");
			var iRowIndex = aTemp[aTemp.length - 1];
			aAttributes.splice(iRowIndex, 1);
			Utils.removeMessagesByPath("/Attributes");
			this.oModel.updateBindings();
		},
		
		handleAttrTypeChange : function(oEvent) {
			var selectedIndex = getIndexFromEvent(oEvent);
			var selectedKey = oEvent.getSource().getSelectedKey();
			var selAttr = this.oAttributeStructure[selectedKey];
			if(selectedKey) {
				var attr = jQuery.extend({}, selAttr, {
					AttributeTypeDescSelKey: selAttr.AttributeTypeDescriptions[0].AttributeId,
					AttributeLanguageSelKey: selAttr.AttributeLanguageSet.length ? "EN" : "",
					AttributeValue: ""
				});
				this.oModel.setProperty("/Attributes/" + selectedIndex, attr);
				this.setListAttributeValues(selectedIndex).then(function () {
					this.oModel.updateBindings(true);
				}.bind(this));
			} else {
				this.oModel.setProperty("/Attributes/" + selectedIndex, selAttr);
			}
		},
		
		setListAttributeValues: function(index) {
			var data = this.oModel.getProperty("/Attributes/" + index);
			var key = data.AttributeTypeDescSelKey;
			var value = data.AttributeValue;
			if(data.AttributeTypeSelKey !== Constants.ATTRIBUTE_CONST_TYPE.list || !key) {
				return Promise.resolve(value);
			}
			var attributePath = "/Attributes/" + index;
			if(!this.oAttributeValues[key]) {
				this.oModel.setProperty(attributePath + "/BusyList", true);
				return Models.getAttributeValues(key).then(function(result) {
					this.oAttributeValues[key] = result.data;
					this.oModel.setProperty(attributePath + "/attributeValueList", this.oAttributeValues[key]);
					this.oModel.setProperty(attributePath + "/AttributeValue", result.data[0].Value);
					this.oModel.setProperty(attributePath + "/BusyList", false);
					return value;
				}.bind(this));
			} else {
				this.oModel.setProperty(attributePath + "/attributeValueList", this.oAttributeValues[key]);
				this.oModel.setProperty(attributePath + "/AttributeValue", this.oAttributeValues[key][0].Value);
				return Promise.resolve(value);
			}
		},
		
		handleTypeDescriptionChange: function(oEvent){
			var selectedIndex = getIndexFromEvent(oEvent);
			var key = oEvent.getSource().getSelectedKey();
			var attributePath = "/Attributes/" + selectedIndex;
			this.oModel.setProperty(attributePath + "/attributeTypeDescriptionSelectedType", key);
			this.oModel.setProperty(attributePath + "/attributeValueListSelectedKey", "");
			if (Constants.ATTRIBUTE_CONST_TYPE.list === this.oModel.getProperty(attributePath + "/AttributeTypeSelKey")) {
				this.setListAttributeValues(selectedIndex);
			}
		},
		
		validateForm: function() {	
			var aAttr = this.oModel.getProperty("/Attributes");	
			var items = [];
			var errors = [];
			var hasErrors = false;
			Utils.removeMessagesByPath("/Attributes");
			
			for (var i = 0; i < aAttr.length; i++) {
				hasErrors = false;
				var languageCheck = (aAttr[i].AttributeLanguageSet.length) ? aAttr[i].AttributeLanguageSelKey : "";				
				var item = {
					"AttributeType": aAttr[i].AttributeTypeSelKey, 
					"Attribute": aAttr[i].AttributeTypeDescSelKey, 
					"Value": aAttr[i].AttributeValue, 
					"Language": aAttr[i].AttributeLanguageSelKey,
					"ComparisonString": aAttr[i].AttributeTypeSelKey + aAttr[i].AttributeTypeDescSelKey + languageCheck
				};
				if(!check(aAttr[i], "AttributeTypeSelKey")) {
					hasErrors = true;
					errors.push(new Message({
					message: this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Type"),
						description: this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeTypeRow", i + 1),
						type: "Error",
						target: getTarget(i, "/AttributeTypeSelKey"),
						processor: this.oModel
					}));
				}
				
				if(!check(aAttr[i], "AttributeTypeDescSelKey")) {
					hasErrors = true;
					errors.push(new Message({
					message: this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Name"),
						description: this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeNameRow", i + 1),
						type: "Error",
						target: getTarget(i, "/AttributeTypeDescSelKey"),
						processor: this.oModel
					}));
				}
				
				if(!check(aAttr[i], "AttributeValue") && item.AttributeType !== Constants.ATTRIBUTE_CONST_TYPE.tag) {
					hasErrors = true;
					errors.push(new Message({
					message: this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Value"),
						description: this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeValueRow", i + 1),
						type: "Error",
						target: getTarget(i, "/AttributeValue"),
						processor: this.oModel
					}));
				}
				
				if(!check(aAttr[i], "AttributeLanguageSelKey") && item.AttributeType === Constants.ATTRIBUTE_CONST_TYPE.text) {
					hasErrors = true;
					errors.push(new Message({
					message: this.i18nModel.getResourceBundle().getText("Attributes.Errors.Invalid.Language"),
						description: this.i18nModel.getResourceBundle().getText("Attributes.Errors.InvalidAttributeLanguageRow", i + 1),
						type: "Error",
						target: getTarget(i, "/AttributeLanguageSelKey"),
						processor: this.oModel
					}));
				}
				if(!hasErrors){
					items.push(item.ComparisonString);
				}
			}
			
			if (findDuplicates(items)) {
				errors.push(new Message({
					message: this.i18nModel.getResourceBundle().getText("Attributes.Must.Be.Unique"),
					description: this.i18nModel.getResourceBundle().getText("Attributes.Cannot.HaveSame.Attribute.Description"),
					type: "Error",
					target: "/Attributes",
					processor: this.oModel
				}));
			}
			
			this.oMessageManager.addMessages(errors);
			return errors.length;
			
		},
		
		setOfferData : function(data, staticData){
			this.aTypeDesc = uniqueArray(staticData.AttributeSet || []);
			this.contentModel.setProperty("/Editable", !data.Readonly);
			
			this.setAttributeStructure(staticData);
			var attributes = (data.Attributes || []).map(function(attr){
				return jQuery.extend({}, this.oAttributeStructure[attr.AttributeType], {
					AttributeTypeDescSelKey: attr.Attribute,
					AttributeValue: attr.Value,
					AttributeLanguageSelKey: attr.Language
				});
			}.bind(this));
			
			this.oModel.setData({ Attributes: attributes});
			this.oModel.getProperty("/Attributes").forEach(function(val, index){
				if (val.AttributeTypeSelKey === Constants.ATTRIBUTE_CONST_TYPE.list) {
					this.setListAttributeValues(index).then(function(key){
						this.oModel.setProperty("/Attributes/" + index + "/AttributeValue", key);
					}.bind(this));
				} else if (val.AttributeTypeSelKey === Constants.ATTRIBUTE_CONST_TYPE.image) {
					Models.getImageInformation(val.AttributeValue).then(function(oData) {
						this.oModel.setProperty("/Attributes/" + index + "/AttributeImageUrl", oData.Url);
					}.bind(this));
				}
			}.bind(this));
			this.oModel.updateBindings(true);
		},
		
		getOfferData : function(){
			var items = this.oModel.getProperty("/Attributes") || [];
			var attributes = items.map( function(oItem) {
				
				return {
					"AttributeType": oItem.AttributeTypeSelKey,
					"Attribute": oItem.AttributeTypeDescSelKey,
					"Value": oItem.AttributeValue,
					"Language": oItem.AttributeLanguageSelKey
				};	
			});
						
			return {
				Attributes : attributes
			};
		},
		
		processServerErrors: function(aMessages) {
			Utils.setErrorMessages(this.oMessageManager, aMessages, this.oModel);
			Utils.removeMessagesByPath("/Attributes");
		},
		
		resetAttributes: function(){
			this.oModel.setProperty("/",[]);
		}
	});
	
});
