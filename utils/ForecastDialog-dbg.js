/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"retail/pmr/promotionaloffers/utils/Utils",
	"sap/ui/model/json/JSONModel",
	"sap/viz/ui5/format/ChartFormatter",
	"sap/viz/ui5/api/env/Format"
], function(Utils, JSONModel, Formatter, Format) {
	"use strict";
	
	var _offerLevel = 1;
	var _termLevel = 2;
	var _productLevel = 3;
	
	var _oDialog = null;
	
	function _createDialog(oModel, oText) {
		
		if (_oDialog) {
			return;
		}
		
		_oDialog = sap.ui.xmlfragment("retail.pmr.promotionaloffers.fragments.Forecast", {
			onOK: function() {
				_oDialog.close();
				_oDialog.destroy();
				_oDialog = null;
			}
		});
		
		_oDialog.setModel(oModel);
		_oDialog.setModel(oText, "i18n");
		
		//Waterfall chart config
		Format.numericFormatter(Formatter.getInstance());
        var formatPattern = Formatter.DefaultPattern;
		
		var oConfigFall = {
			interaction: {
				selectability: {
					mode: "NONE"
				}
			},
			title: { 
				visible: false
			}, 
			categoryAxis: { 
				title: { 
					visible: false
				}
			}, 
			valueAxis: { 
				title: {
					visible: true,
					text: "Net Units"
				}
			}, 
			plotArea: { 
				dataLabel: { 
					formatString: formatPattern.STANDARDINTEGER,
					visible: true 
				}
			}
		};
		
		var oConfigCol = {
			interaction: {
				selectability: {
					mode: "NONE"
				}
			},
			title: { 
				visible: false
			}, 
			categoryAxis: { 
				title: { 
					visible: false
				}
			}, 
			valueAxis: { 
				title: {
					visible: false
				}
			}, 
			plotArea: { 
				dataLabel: { 
					formatString: formatPattern.STANDARDINTEGER,
					visible: true 
				}
			}
		};		
		
		//Set model for flattened data
		var oData = new JSONModel();
		oData.setData( {
			ConfigFall: oConfigFall,
			ConfigCol: oConfigCol,
			Decomposition: [],
			Confidence: []
		});
		
		_oDialog.setModel(oData, "data");
	}
	
	function _processData(oResponse) {
		
		var oModel = _oDialog.getModel();
		var oI18n = _oDialog.getModel("i18n");
		var oData = _oDialog.getModel("data");
		var iTotal = 0;
		var iSum = 0;
		
		//Flatten forecast fields into array
		var aDecomposition = [];
		
		//Baseline fields
		var aBaseFields = ["Base", "Seasonality", "Holidays"];
		aBaseFields.forEach(function(sField) {
			iSum += Math.round(parseFloat(oResponse[sField], 10));
			iTotal += Math.round(parseFloat(oResponse[sField], 10));
			switch(sField){
			case "Base":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.Base"),
					Forecast: Math.round(oResponse[sField])
				});
			break;
			case "Seasonality":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.Seasonality"),
					Forecast: Math.round(oResponse[sField])
				});
			break;
			case "Holidays":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.Holidays"),
					Forecast: Math.round(oResponse[sField])
				});
			break;
		}});
	
		//Subtotal for baseline fields
		aDecomposition.push(
			{
				Type: "subtotal:3",
				Category: oI18n.getProperty("ForecastDialog.Baseline"),
				Forecast: iSum
			});
		iSum = 0;
		
		if(oResponse.hasOwnProperty('UserDIF')){
		//Other fields
		var aOtherFields = ["UserDIF"];
		aOtherFields.forEach(function(sField) {
			iSum += Math.round(parseFloat(oResponse[sField], 10));
			iTotal += Math.round(parseFloat(oResponse[sField], 10));
			aDecomposition.push(
			{
				Type: "null",
				Category: oI18n.getProperty("ForecastDialog.UserDIF"),
				Forecast: Math.round(oResponse[sField])
			});
		});
	
		//Subtotal for other fields
		aDecomposition.push(
			{
				Type: "subtotal:4",
				Category: oI18n.getProperty("ForecastDialog.Other"),
				Forecast: iSum
			});
		iSum = 0;
		}
		
		// Promotional fields
		var aPromoFields = ["PriceChanges", "LiftImpactType", "TacticImpact", "RewardIncentives"];
		aPromoFields.forEach(function(sField) {
			iSum += Math.round(parseFloat(oResponse[sField], 10));
			iTotal += Math.round(parseFloat(oResponse[sField], 10));
			switch(sField){
			case "PriceChanges":	
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.Price"),
					Forecast: Math.round(oResponse[sField])
				});
				break;
			
			case "LiftImpactType":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.LiftImpactType"),
					Forecast: Math.round(oResponse[sField])
				});
				break;
			
			case "TacticImpact":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.TacticImpact"),
					Forecast: Math.round(oResponse[sField])
				});
				break;
				
			case "RewardIncentives":
				aDecomposition.push(
				{
					Type: "null",
					Category: oI18n.getProperty("ForecastDialog.RewardIncentives"),
					Forecast: Math.round(oResponse[sField])
				});
				break;
		}});
			
		//Subtotal for promo fields
		iSum += Math.round(parseFloat(oResponse.Cannibalization, 10));
		iTotal += Math.round(parseFloat(oResponse.Cannibalization, 10));			
		aDecomposition.push(
			{
				Type: "subtotal:5",
				Category: oI18n.getProperty("ForecastDialog.PromotionalLift"),
				Forecast: iSum
			});	
			
		//Total
		aDecomposition.push(
			{
				Type: "total",
				Category: "Total",
				Forecast: iTotal
			});	
			
		//Forecast confidence break down
		var aConfidenceFields = ["ProdLocsWithLowFCI", "ProdLocsWithMediumFCI", "ProdLocsWithHighFCI", "ProdLocsWithoutForecast" ];			
		var aConfidence = [];
		
		aConfidenceFields.forEach(function(sField) {
			aConfidence.push(
			{
				Category: oModel.getProperty("/#Forecast/" + sField + "/@sap:label"),
				Locations: oResponse[sField]
			});
			
		});
			
		oData.setProperty("/Decomposition", aDecomposition);
		oData.setProperty("/Confidence", aConfidence);
	}
	
	function _bindDialog(iLevel, oContext) {
		
		var sPath = "";
		switch (iLevel) {
			case _offerLevel: 
				sPath = "/Offers(binary'" + Utils.base64ToHex(oContext.OfferId) + "')/Forecast";
				break;
			case _termLevel:
				sPath = "/OfferTerms(OfferId=binary'0',TermId=binary'" + Utils.base64ToHex(oContext.TermId) + "')/Forecast";
				break;
			case _productLevel:
				sPath = "/TermProducts(binary'" + Utils.base64ToHex(oContext.TermProductId) + "')/Forecast";
				break;
		}
		
		var oModel = _oDialog.getModel();
		oModel.read( sPath, { success: _processData });
	}
	
	/* Export */
	var oDialog = {
		
		show: function(iLevel, oContext, oModel, oText) {
			_createDialog(oModel, oText);
			_bindDialog(iLevel, oContext);
			_oDialog.open();
		},
		
		close: function() {
			_oDialog.close();	
		},
		
		Level: {
			Offer: _offerLevel,
			Term: _termLevel,
			Product: _productLevel
		}
	};

	return oDialog;
	
}, /* bExport= */ true);