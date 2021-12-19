/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"retail/pmr/promotionaloffers/utils/Utils",
		"retail/pmr/promotionaloffers/utils/DateHandler",
		"retail/pmr/promotionaloffers/utils/Formatter",
		"retail/pmr/promotionaloffers/plugins/versions/VersionsSelector",
		"retail/pmr/promotionaloffers/utils/controls/ValueHelpDialogTokenizer"
	], function(Controller, JSONModel, Utils, DateHandler, FormatterHelper, VersionsSelector, ValueHelpDialogTokenizer) {

	"use strict";
	
	
	return Controller.extend("retail.pmr.promotionaloffers.plugins.productGroup.BasicData", {
		
		constructor : function(){
			this.contentModel = new JSONModel();
			this.dataModel = new JSONModel();
			this.timeModel = new JSONModel();
		},
		
		onInit: function() {
			this.getView().setModel(this.contentModel, "Content");
			this.getView().setModel(this.dataModel);

			var resourceModel = Utils.getResourceModel();
			this.getView().setModel(resourceModel, "i18n");
			
			this.contentModel.setProperty("/Editable", true);
			this.oMessageManager = Utils.getMessageManager();
			this.i18nModel = Utils.getResourceModel();
			

		},
		
		
		
		getProductGroupData : function() {
			var oData = jQuery.extend({}, this.dataModel.getData());
			
			return oData;
		},
		
		setNameMode: function(editable) {
			this.contentModel.setProperty("/EditableName", editable);
		},
		
		setProductGroupData : function(data, IsNew) {	
			this.dataModel.setData(data);	
			this.contentModel.setProperty("/ReadOnly", !!data.Display);
			this.contentModel.setProperty("/EditableName", IsNew);
		},
		
		markErrors: function() {
			var aItems = this.getErrorItems();
			var aErrorMessages = this.buildErrors(aItems);
			for (var i = 0; i < aItems.length; i++) {
				Utils.removeMessagesByPath(aItems[i].Target);				
			}
			Utils.setErrorMessages(this.oMessageManager, aErrorMessages);			
			return aErrorMessages.length;
		},
		
		validateForm: function() {
			
			var validate = this.markErrors();
			
			return validate;
		},
		
		getErrorItems: function() {
			var aItems = [{
				Property: "/Name",
				Target: "/Name",
				Mandatory: true,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.ProductGroupName.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.ProductGroupName.Description"),
				ErrorTitleTooLong: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.TitleTooLong"),
				ErrorDescriptionTooLong: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferName.DescriptionTooLong")
			}, {
				Property: "/Description",
				Target: "/Description",
				Mandatory: false,
				Model: this.dataModel,
				TargetModel: this.dataModel,
				ErrorTitle: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferDescription.Title"),
				ErrorDescription: this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralOfferDescription.Description")
			}];

			return aItems;
		},
		
		buildErrors: function(arry) {
			var validateItem = function(oItem, value) {
				var oErrorInfo = null;
				
				switch (oItem.Property) {
					case "/Name":
						if (value.length > 40) {
							oErrorInfo = {
									Title: oItem.ErrorTitleTooLong,
									Description: oItem.ErrorDescriptionTooLong
							};
						}
						break;
					case "/Description":
						if (value && value.length > 255) {
							oErrorInfo = {
									Title: oItem.ErrorTitle,
									Description: oItem.ErrorDescription
							};
						}
						break;
					
				}
				return oErrorInfo;
			}.bind(this);

			var aErrorMessages = [];
			arry.forEach(function(oItem) {
				var value = oItem.Model.getProperty(oItem.Property);
				var bMandatoryField = oItem.Mandatory; 
				var oErrorInfo = null;

				if (bMandatoryField && !value) {
					oErrorInfo = {
							Title: oItem.ErrorTitle,
							Description: oItem.ErrorDescription
					};
				} else {
					oErrorInfo = validateItem(oItem, value);
				}

				if (oErrorInfo) {
					aErrorMessages.push({
						message: oErrorInfo.Title,
						description: oErrorInfo.Description,
						target: oItem.Target,
						type: "Error",
						processor: oItem.TargetModel
					});
				}
			}.bind(this));

			return aErrorMessages;
		}
	});
});