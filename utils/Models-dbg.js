/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define([
               "retail/pmr/promotionaloffers/utils/Utils",
               "sap/ui/comp/odata/MetadataAnalyser"
              ], function(Utils, MetadataAnalyser){
					"use strict";
					
					function Cache(){
						this.data = {};
					}
					Cache.prototype.store = function(pathElements, data){
						this.data[pathElements.join("-")] = data;
					};
					Cache.prototype.get = function(pathElements){
						return this.data[pathElements.join("-")];
					};
					Cache.prototype.has = function(/*pathElements*/){
						return !!this.get.apply(this, arguments);
					};
					
					
					function defaultCacheKeyGenerator(){
						var cacheKey = Array.prototype.splice.call(arguments, 0);
						if(!cacheKey.length){
							return ["Cached"];
						}
						return cacheKey;
					}
					

					function withCache(fn, cacheKeyCreator){
						cacheKeyCreator = cacheKeyCreator || defaultCacheKeyGenerator;
						
						var cache = new Cache();
						return function(){
							var rebuildCache = arguments[arguments.length - 1];
							var cacheKey = cacheKeyCreator.apply(this, arguments);
							if(!rebuildCache && cache.has(cacheKey)){
								return cache.get(cacheKey);
							}
							var promiseResult = fn.apply(this, arguments);
							cache.store(cacheKey, promiseResult);
							return promiseResult.then(null, function(error){
								cache.store(cacheKey, null);
								throw error;
							});
						};
					}
					
					function withInvalidatableCache(fn, cacheKeyCreator){
						cacheKeyCreator = cacheKeyCreator || defaultCacheKeyGenerator;
						var cache = new Cache();
						
						function f(){
							var cacheKey = cacheKeyCreator.apply(this, arguments);
							
							if(cache.has(cacheKey)){
								return cache.get(cacheKey);
							}
							
							var promiseResult = fn.apply(this, arguments);
							cache.store(cacheKey, promiseResult);
							return promiseResult.then(null, function(error){
								cache.store(cacheKey, null);
								throw error;
							});
						}
						
						f.invalidate = function(){
							var cacheKey = cacheKeyCreator.apply(this, arguments);
							cache.store(cacheKey, null);
						};
						
						return f;
					}
					
					function withTrace(fn){
						return function tracedCall(){
							return fn.apply(this, arguments).then(Utils.identity, function(e){
								jQuery.sap.log.trace(e);
								return Promise.reject(e);
							});
						};
					}
					
					//Cache for leading categories per MD system
					var leadingCategoriesCache = {};

					var ProductSearchValueHelpEndPoints = [{
						entityName : "Currency",
						methodName : "getCurrency"
					}, {
						entityName : "SalesOrg",
						methodName : "getSalesOrg"
					},{
						entityName : "DistChannel",
						methodName : "getDistChannel"
					},{
						entityName : "ProductStatus",
						methodName : "getProductStatus",
						masterdataSystemIndependent : true
					}, {
						entityName : "ProductUoM",
						methodName : "getProductUoM",
						masterdataSystemIndependent : true
					}];

					var EntitySets = [
					        {
			            		"EntitySet": "MasterDataSystemSet",
			            		"EndPoint": "/MasterdataSystems",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "AttributeSet",
			            		"Params": {
			            			$filter: "Object eq '01'"
			            		},
			            		"EndPoint": "/Attributes",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "LanguageSet",
			            		"Params": {
			            			EntityType: "'Attribute'",
			            			PropertyName: "'Language'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "Tactics",
			            		"EndPoint": "/Tactics",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "ProductDimensionsSet",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'ProductDimension'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "DiscountTypeSet",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'DiscountType'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet" : "DiscountAssignmentSet",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'DiscountAssignment'"
			            		},
			            		"EndPoint" : "/GetHelpValues",
			            		"Method" : "GET"
			            		
			            	},
			            	{
			            		"EntitySet" : "DiscountVarietySet",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'Variety'"
			            		},
			            		"EndPoint" : "/GetHelpValues",
			            		"Method" : "GET"
			            		
			            	},
			            	{
			            		"EntitySet": "TermStyles",
			            		"Params": {
			            			$expand: "Sections,Sections/Rules,Sections/SectionItems,Sections/SectionItems/SectionItemRules"
			            		},
			            		"EndPoint": "/TermStyles",
			            		"Method" : "GET"
			            	},
			            	{
			            		"EntitySet": "FeaturesAvailable",
			            		"EndPoint": "/FeatureSwitches",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "PriceTypes",
			            		"Params": {
			            			EntityType: "'ProductDetail'",
			            			PropertyName: "'PriceType'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "ProductTypes",
			            		"Params": {
			            			EntityType: "'ProductDetail'",
			            			PropertyName: "'ProductType'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},			            	
			            	{
			            		"EntitySet": "EnforceMultiple",
			            		"Params": {
			            			EntityType: "'Offer'",
			            			PropertyName: "'EnforceMultiple'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "WhenOptions",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'WhenOption'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "GetOptions",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'GetOption'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "Weeks",
			            		"EndPoint": "/Weeks",
			            		"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "IncentiveDefinitions",
			            		"EndPoint": "/IncentiveDefinitions",
			            		"Method": "GET"
			            	},
			            	{
			            			"EntitySet": "Purpose",
			            			"EndPoint": "/SH_H_DMF_PROC_PURPOSE",
			            			"Method": "GET"
			            	},
			            	{
			            		"EntitySet": "ForecastConfidence",
			            		"Params": {
			            			"EntityType": "'Offer'",
			            			"PropertyName": "'ForecastConfidence'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method": "GET"
			            	},
 			            	{
			            		"EntitySet": "CurrencyListSet",
			            		"Params": {
			            			EntityType: "'Term'",
			            			PropertyName: "'CurrencyList'"
			            		},
			            		"EndPoint": "/GetHelpValues",
			            		"Method" : "GET"
			            	}
			            ];

					var EntitySetMocks = [
						{
							"EntitySet": "LinkToSet",
							"Mock" : true,
							"Data" : [ {
								"LinkToName" : "Default",
								"LinkToId" : "1"
							}, {
								"LinkToName" : "Default 2",
								"LinkToId" : "2"
							} ]
						},
						{
							"EntitySet": "TypeSet",
							"Mock" : true,
							"Data" : [ {
								"AttributeTypeName" : "Image",
								"AttributeTypeId" : "01"
							},
							{
								"AttributeTypeName" : "Text",
								"AttributeTypeId" : "02"
							}, {
								"AttributeTypeName" : "Date",
								"AttributeTypeId" : "04"
							} ]
						}				
                   	];

					var initialData = {};
					
					var postponeModelRefresh = false;

					var Models = {
						init: function(model) {
							this.model = model;
						},
						postponeModelRefresh: function(bSwitch) {
							postponeModelRefresh = bSwitch;	
						},
						isModelRefreshPostponed: function() {
							return postponeModelRefresh;
						},
						getMetadataAnalyzer: function() {
							return this.model.getMetaModel().loaded().then(function(){
								return  new MetadataAnalyser(this.model);
							}.bind(this));
						},
						getInitialData : function(){
							return initialData;
						},
						valueHelp : function(entityName, masterDataSystemIndependent){
							var that = this;
							return function valueHelpFn(masterDataSystem){
								var params = {
									EntityType: "'Term'",
									PropertyName: "'" + entityName + "'"
								};
								if(masterDataSystem && !masterDataSystemIndependent) {
									params.MasterdataSystem = "'" + masterDataSystem + "'";
								}
								var endpoint = "/GetHelpValues";
								return that.read(endpoint, params, function(data){
									return data;
								});
							};
						},
						read: function(endpoint, params, resultMapper){
							var model = this.getServiceModel();
							resultMapper = resultMapper || Utils.identity;
							return new Promise(function(resolve, reject) {
								model.read(endpoint, {
									urlParameters: params || null,
							   		success : function(data){
							   			resolve(resultMapper(data));
						   			},
									error : function(error){
										reject(error);
									}
								});
							});
						},
						getServiceModel: function(){
							return this.model;
						},
						getNamespace: function(oModel) {
							try {
								return oModel.getServiceMetadata().dataServices.schema[0].namespace;
							} catch (e) {
								return "OFFER_MANAGEMENT_SRV";
							}
						},
						
						updateOffer: function(expands, selectedPath){
							var that = this;
							
							return new Promise(function(resolve, reject) {
								var model = that.getServiceModel();
								model.setUseBatch(true);
								model.read(selectedPath,  {
									urlParameters: {
										"$expand": expands
									},
									success: function(oReturnedData) {
										resolve({
											data : oReturnedData,
											response: {}
										});
										model.setUseBatch(false);
									},
									error: function(err){
										reject(err);
										model.setUseBatch(false);
									}
								});
								
							});
						},
						
						fetchDefaultValues: withCache(function(expands){
							var path = "/Offers(binary'0000000000000000')";
							return this.updateOffer(expands, path);
						}, function(){
							return ["OfferDefaults"];
						}),
						fetchDataForVendorFund : function(expands, vendorId){
							var sEndpoint = "/VendorFunds('" + vendorId + "')/Offer";
							var oModel = this.getServiceModel();
							
							var params = {
									$expand: expands
							};
						
							return new Promise(function(resolve, reject) {
								oModel.read(sEndpoint, {
									async: true,
									urlParameters: params,
									success : function(oReturnedData, oResponse){
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : function(error){
										reject(error);
									}
								});
							});
							
						},
						createNewOffer : function(savePayload) {
							var model = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								model.create("/Offers", jQuery.extend({}, savePayload), {
									async : true,
									success : function(oReturnedData, oResponse){
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : reject
								});
							});
						},
						copyOffer : function(offerId, copyPayload) {
							return this.createNewOffer(copyPayload);
						},
						updateSelectedOffer: function(editPayload){
							return this.createNewOffer(editPayload);
						},
						getImageInformation: function(sId, oInfo){
							var model = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								model.read("/Images(binary'" + sId + "')", {
									urlParameters: null,
									async: false,
									success : function(data){
										resolve(data);
									},
									error : function(error){
										reject(error);
									}
								});
							});
						},
						getImages: withCache(function() {
							return this.read("/Images", {}, function(data){
								return {
									data : data.results || []
								};
							});
						}),
						
						getAttributeValues: function(sSearch) {
							return this.read("/ATTR_05_" + sSearch + "Values", null, function(data) {
								return {
									data : data.results || []
								};
							});
						},
						
						getServiceData : withCache(function() {
							var model = this.getServiceModel();

							function success(oReturnedData) {
								function getDataFromResponse(dataToParse) {
									//In some cases data may be completely empty. E.g. UI is talking to older backend
									//Lack of data must be handled by consumer
									if (!dataToParse) {
										return [];
									}
									
									if (typeof dataToParse.response === "undefined") {
										return dataToParse.data.results;
									} else {
										throw new Error(JSON.parse(dataToParse.response.body));
									}
								}
								var data = {};

								EntitySets.reduce(function(data, item, index){
									data[item.EntitySet] = getDataFromResponse(oReturnedData.__batchResponses[index]);
									if (item.EntitySet === "FeaturesAvailable") {
									   var isCouponOfferPresent = data["FeaturesAvailable"].some(function(el) {  return  el.Key === "CouponOffers"; }); 
                                       // If Couponoffers feature is missing in the backend, lookup VendorFunds feature to add it"
                                       if (!isCouponOfferPresent) {
									     var vendorFundObj = data["FeaturesAvailable"].filter(function(el) { return el.Key === "VendorFunds"; });
									     var couponOfferObj = JSON.parse(JSON.stringify(vendorFundObj));
									     couponOfferObj[0].Key = "CouponOffers";
									     data["FeaturesAvailable"].push(couponOfferObj[0]);
                                       }
								   }									   
								   return data;
								}, data);
								
								EntitySetMocks.reduce(function(data, item){
									data[item.EntitySet] = item.Data;
									return data;
								}, data);


								initialData = data;


								return {
									data : data
								};
							}

							return new Promise(function(resolve, reject) {
								//Wait until metadata are loaded as we use them to check exitence of entity set
								model.metadataLoaded().then( function() {
									model.setUseBatch(true);
									model.setDeferredGroups(["batchCalls"]);
									EntitySets.forEach(function(set, index, object){
										
										//Check if purposes can be retrieved
										if (set.EntitySet === "Purpose") {
											var oSet = model.getMetaModel().getODataEntitySet(set.EndPoint.substring(1));
											if (oSet === null) {
												jQuery.sap.log.warning("Entity set " + set.EntitySet + " does not exist in metadata");
												object.splice(index, 1);
												return;	
											}
										}
									
										model.read(set.EndPoint, {
											groupId: "batchCalls",
											urlParameters: set.Params || null
										});
									});
								
									model.submitChanges({
										groupId: "batchCalls", 
										success: function(result) {
											var data = success(result);
											resolve(data);
											model.setUseBatch(false);
										},
										error: function(oError){
											reject(oError);
											model.setUseBatch(false);
										}
									});
								});
							});

							
						}),
						
						getVendorFunds : function(payload) {
							var aPath =  ["__batchResponses", 0, "__changeResponses", 1, "data", "AvailableFunds", "results"];
							return this.batchCallsOffersTwoOperations(payload, "/DetermineVendorFunds", aPath);
						},
						
						getCollision : function(payload) {
							var aPath = ["__batchResponses", 0, "__changeResponses", 1, "data", "Collisions", "results"];
							payload.Collisions = [];
							return this.batchCallsOffersTwoOperations(payload, "/DetermineCollisions", aPath);
						},
						determineLocations : function(masterDataSystem, locationNodeId, hierarchyId, filters, subgroups, dates){
							var payload = {
								MasterdataSystem : masterDataSystem,
								LocationNodeId : locationNodeId,
								HierarchyId : hierarchyId,
								LocationFilters : filters,
								ExcludedNodes : [{ Id : "", OfferId : ""}],
								StartOfOffer: dates.start,
								EndOfOffer: dates.end
							};
							if(subgroups) {
								payload.LocationSubgroups = subgroups;
							}
							
							var resultPath = [];
							return this.batchCallsOffersTwoOperations(payload, "/DetermineLocations", resultPath);
						},
						
						mergeVisibleProducts: function(masterdataSystem, key, dimension, type, termData){
							var tModel = this.getServiceModel();
							
							var sPostPath = "/Offers";
							var aShowHideProducts = [];
							if (termData.TermProducts) {
								termData.TermProducts.forEach(function (product) {
									if (product.Visibility && product.Visibility !== "") {
										aShowHideProducts.push({
											Id: product.Id,
								    		ProductId: product.ProductId,
								    		Visibility: product.Visibility
								    	});
									}
								});
							}
							var payload =
							 {
							 	"OfferId": termData.OfferId,
							 	"Status": "99", 
								"Terms": [
									{
										"OfferId": termData.OfferId,
										"TermId": termData.TermId,
										"TermProducts": aShowHideProducts
									}
								]
							 };
							var endPoint = "/TermObjects";
							var count = 10;
							var search = function nameFilter(sKey){
								return (sKey ?  "*" + sKey + "*" : "");
							};
							var masterDataSystemFilter = function(system){
								return "MasterdataSystem eq '" + system + "'";
							};
							var dimensionFilter = function dimensionFilter(dim){
								return (dim ? " and Dimension eq '" + dim + "'" : "");
							};
							var typeFilter = function(sType) {
								return (sType ? " and Type eq '" + sType + "'" : "");
							};
							var params = {
									$top: count,
									search: search(key),
									$filter: masterDataSystemFilter(masterdataSystem)
										+ dimensionFilter(dimension)
										+ typeFilter(type),
									$expand : "UnitOfMeasures,Children,Children/UnitOfMeasures"
							};

							return new Promise(function(resolve, reject) {
								tModel.setUseBatch(true);
								tModel.setRefreshAfterChange(false);
								tModel.setDeferredGroups(["batchCalls"]);
								// post visible products via "/Offers"
								tModel.create(sPostPath, payload, { groupId: "batchCalls", changeSetId : jQuery.sap.uid() });
								// read get_expanded_entityset via "/TermObjects";
								tModel.read(endPoint, {
									groupId : "batchCalls", changeSetId : jQuery.sap.uid(),
									urlParameters: params
								});

								tModel.submitChanges({
									groupId: "batchCalls", 
									success: function(oReturnedData) {
										var getResults = oReturnedData.__batchResponses[1];
										resolve({
											Products : getResults.data.results
										});
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									},
									error: function(oError){
										reject(oError);
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									}
								});				
							});
						},						
						
						getProducts : function(masterdataSystem, key, dimension, type) {
							var endPoint = "/TermObjects";
							var count = 10;

							var search = function nameFilter(sKey){
								return (sKey ?  "*" + sKey + "*" : "");
							};
							var masterDataSystemFilter = function(system){
								return "MasterdataSystem eq '" + system + "'";
							};

							var dimensionFilter = function dimensionFilter(dim){
								return (dim ? " and Dimension eq '" + dim + "'" : "");
							};
							
							var typeFilter = function(sType) {
								return (sType ? " and Type eq '" + sType + "'" : "");
							};
							
							var params = {
									$top: count,
									search: search(key),
									$filter: masterDataSystemFilter(masterdataSystem)
										+ dimensionFilter(dimension)
										+ typeFilter(type),
									$expand : "UnitOfMeasures,Children,Children/UnitOfMeasures"
							};

							return this.read(endPoint, params, function(data){
								return {
						 			Products : data.results
								};
							});
						},

						/*
						 * Searches for one product by name or id.
						 */
						searchProduct: withTrace(function(masterdataSystem, key, dimension, type) {
							var endPoint = "/TermObjects";
							var count = 1;

							var search = function(sKey) {
								return (sKey ? sKey : "");
							};

							var masterDataSystemFilter = function(system) {
								return "MasterdataSystem eq '" + system + "'";
							};

							var searchFilter = function(sKey) {
								return (sKey ? " and ExtNodeId eq '" + sKey + "'" : "");
							};

							var dimensionFilter = function(dim) {
								return (dim ? " and Dimension eq '" + dim + "'" : "");
							};

							var typeFilter = function(sType) {
								return (sType ? " and Type eq '" + sType + "'" : "");
							};
							
							var params = {
									$top: count,
									search: search(key),
									$filter: masterDataSystemFilter(masterdataSystem)
										+ searchFilter(key)
										+ dimensionFilter(dimension)
										+ typeFilter(type),
									$expand: "ProductDetail,UnitOfMeasures,Children,Children/UnitOfMeasures"
							};
							
							return this.read(endPoint, params, function(data){
								return {
									Products : data.results
								};
							});
						}),

						getFeaturesAvailable: withTrace(withCache(function() {
							return this.read("/FeatureSwitches", null, function(data){
								return data.results || [];
							});
						})),
						
						getTermObjects : withTrace(withCache(function(masterdataSystem, dimension){
							var searchUrl = "/TermObjects";
							var masterDataSystemFilter = function(system){ return "MasterdataSystem eq '" + system + "'"; };
							var dimensionFilter = function dimensionFilter(dim){	return (dim ? " and Dimension eq '" + dim + "'" : "");	};
							var cardinalityFilter = " and Cardinality gt 0";
							var params = {
								$filter: masterDataSystemFilter(masterdataSystem) + dimensionFilter(dimension) + cardinalityFilter
							};
							return this.read(searchUrl, params, function(data){
								return {
						 			TermObjects : data.results
								};
							});
						})),
						
						getProductById : withTrace(withInvalidatableCache(function(productId, dimension){
							var searchUrl = "/TermObjects";
							function id(sProdId){ return "Id=binary'" + Utils.base64ToHex(sProdId) + "'"; }
							function dim(sDimension){ return "Dimension='" + sDimension + "'"; }
							function search(sId, sDimension) { return searchUrl + "(" + id(sId) + "," + dim(sDimension) + ")"; }
							
							var params = {
								$expand : "ProductDetail,UnitOfMeasures,Children,Children/UnitOfMeasures"
							};
							
							var sProductId = productId ? productId :  "0000000000000000";
							return this.read(search(sProductId, dimension), params, function(data){
								return data;
							});
						}, function(productId, dimension){
			              return [productId, dimension];
			            })),
						
						getProductGroupById : withTrace(function(productGroupId){
							var searchUrl = "/ProductGroups";
							function search(sId) { return searchUrl + "('" + sId + "')"; }
							var params = {
								$expand : "Rules,Nodes,Included,Excluded,Preview,HierarchyPreview,Filters"
							};
							
							var sGroupId = productGroupId ? productGroupId : "0";
							return this.read(search(sGroupId), params, function(data){
								return data;
							});

						}),
						
						getProductDimensions : function() {
							function makeProductDimension(obj) {
								return {
									ProductDimensionName : obj.Value,
									ProductDimensionId : obj.Key
								};
							}
							return Promise.resolve({
								ProductDimensions : this.getInitialData().ProductDimensionsSet.map(makeProductDimension)
							});
						},
						getUnitsOfMeasure : function(product) {
							var unitsOfMeasure = product.UnitOfMeasures.results;
							function makeUnitOfMeasure(uom) {
								return {
									UoMName : uom.Id,
									UoMId : uom.Id,
									Default : uom.Default
								};
							}
							return Promise.resolve({
								UnitsOfMeasure : unitsOfMeasure.map(makeUnitOfMeasure)
							});
						},
						
						getDiscountTypes : function() {
							function makeDiscountTypes(obj) {
								return {
									DiscountTypeName : obj.Value,
									DiscountTypeId : obj.Key
								};
							}
							return Promise
									.resolve({
										DiscountTypes : this.getInitialData().DiscountTypeSet
												.map(makeDiscountTypes)
									});
						},
						getTermStyles : function() {
							return Promise.resolve(this.getInitialData().TermStyles);
						},

						getEnforceMultiple : function(){
							return Promise.resolve(this.getInitialData().EnforceMultiple);
						},

						/**
						 * Gets all master data systems.
						 *
						 * @returns {void}
						 */
						getMasterDataSystems: withCache(function() {
							var initialData = this.getInitialData();
							if (typeof initialData.MasterDataSystemSet === "undefined") {
								return this.read("/MasterdataSystems", null, function(data) {
									initialData.MasterDataSystemSet = data.results;
									return data.results;
								});
							}
							return Promise.resolve(initialData.MasterDataSystemSet);
						}),
						/**
						 * Gets master data system personalization service.
						 *
						 * @returns {object} The personalizer for master data system.
						 */
						getMasterDataSystemPersonalizationService: function() {
							//not launchpad
							if(!sap.ushell || !sap.ushell.Container || !sap.ushell.Container.getService){
								return {
									getPersData : function(){
										return Promise.resolve(null);
									}
								};
							}
							var oPersonalization = sap.ushell.Container.getService("Personalization");
							return oPersonalization.getPersonalizer({
								container: "retail.pmr.promotionaloffers",
								item: "masterDataSystem"
							});
						},

						/**
						 * Gets the master data system to use.
						 *
						 * @returns {string} The master data system ID.
						 */
						getMasterDataSystem: function() {
							return new Promise(function(resolve) {
								var sUrlSystemId = jQuery.sap.getUriParameters().get("systemId");
								var i = null;
								this.getMasterDataSystems().then(function(aSystems) {
									if (sUrlSystemId) {
										for (i = 0; i < aSystems.length; i++) {
											if (aSystems[i].Id === sUrlSystemId) {
												return resolve(sUrlSystemId);
											}
										}
									}
									this.getMasterDataSystemPersonalizationService().getPersData().then(function(oPersonalizationMasterDataSystem) {
										if (oPersonalizationMasterDataSystem) {
											return resolve(oPersonalizationMasterDataSystem);
										}
										for (i = 0; i < aSystems.length; i++) {
											if (aSystems[i].Default === true) {
												return resolve(aSystems[i].Id);
											}
										}
										return resolve(aSystems[0].Id);
									});
								}.bind(this));
							}.bind(this));
						},

						/**
						 * Sets the master data system as personalization data.
						 *
						 * @param {string} sMasterDataSystemId The master data system ID.
						 * @returns {void}
						 */
						setMasterDataSystemPersonalization : function(sMasterDataSystemId) {
							var oPersonalizer = this.getMasterDataSystemPersonalizationService();
							oPersonalizer.setPersData(sMasterDataSystemId);
						},
						createOfferSet: function(sValue){
							var payload = {Id:"", Text: sValue};
							var model = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								model.create("/OfferSets",payload,{
									async : true,
									success : function(oResult){
										initialData.OfferSet.push({Id:oResult.Id,Text:oResult.Text});
										resolve({
											data : oResult
										});
									},
									error : reject
								});
							});
						},
						
						getOfferSet: function(f) {
							var filter = f || null;
							return this.read("/OfferSets", filter, function(oReturnedData){
								return {
									data : oReturnedData.results || []
								};
							});
						},
						
						manageOfferSet: function(offerSets){
							var addOfferSets = offerSets.add;
							var deleteOfferSets = offerSets.remove;
							var updateOfferSets = offerSets.update;
							var tModel = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								tModel.setUseBatch(true);
								tModel.setRefreshAfterChange(false);
								tModel.setDeferredGroups(["batchCalls"]);
								
								addOfferSets.forEach(function(offerSet, index){
									tModel.create("/OfferSets", offerSet, { groupId: "batchCalls", changeSetId: "createBatch" + index});
								});
								updateOfferSets.forEach(function(offerSet, index){
									tModel.update("/OfferSets(binary'" + Utils.base64ToHex(offerSet.Id) + "')", {Text: offerSet.Text}, { groupId: "batchCalls", changeSetId: "updateBatch" + index });
								});
								deleteOfferSets.forEach(function(offerSet, index){
									tModel.remove("/OfferSets(binary'" + Utils.base64ToHex(offerSet.Id) + "')", { groupId: "batchCalls", changeSetId: "deleteBatch" + index });
									
								});								
								
								tModel.submitChanges({
									groupId: "batchCalls", 
									success: function(oReturnedData) {
										resolve({
											returnedData: oReturnedData
										});
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									},
									error: function(oError){
										reject(oError);
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									}
								});				
							});
						},

						getDataSet: withCache(function(dataSetName, sDataSetPath, params, masterDataSystem) {
							if (!masterDataSystem) {
								return Promise.resolve(initialData[dataSetName]);
							}
							if(params.$filter) {
								params.$filter = params.$filter + " and MasterdataSystem eq '" + masterDataSystem + "'";
							} else {
								params.$filter = "MasterdataSystem eq '" + masterDataSystem + "'";
							}
							return this.read(sDataSetPath, params, function(data){
								initialData[dataSetName] = data.results;
								return data.results;
							});
						}, function(dataSetName, sDataSetPath, extraFilter, masterDataSystem) {
							return [dataSetName, sDataSetPath, extraFilter, masterDataSystem];
						}),

						getLocationSet: function(masterDataSystem) {
							var params = {
								$filter: "Cardinality gt 0",
								$expand: "Locations"
							};
							return this.getDataSet("LocationSet", "/LocationHierarchyNodes", params, masterDataSystem);
						},
						
						_getPromotionTypeSetAndPurchasingGroupSet : withCache(function(masterDataSystem){
							//code here
							var model = this.getServiceModel();
							
							return new Promise(function(resolve, reject) {
								model.setUseBatch(true);
								model.setDeferredGroups(["batchPromotionTypeSetAndPurchasingGroupSet"]);
							
								model.read("/PromotionTypes", {
									groupId : "batchPromotionTypeSetAndPurchasingGroupSet",
									urlParameters: {
										$filter : "MasterdataSystem eq '" + masterDataSystem + "'"
									}
								});
																
								model.read("/GetHelpValues", {
									groupId : "batchPromotionTypeSetAndPurchasingGroupSet",
									urlParameters: {
										EntityType: "'Offer'",
										PropertyName: "'PurchasingGroup'",
										MasterdataSystem: "'" + masterDataSystem + "'"
									}
								});
								
								model.submitChanges({
									groupId: "batchPromotionTypeSetAndPurchasingGroupSet", 
									success: function(oReturnedData){
										
										var result = oReturnedData.__batchResponses.map(function(x) { 
											return Utils.get(x, ["data", "results"]) || [];
										});
										
										resolve(result);
										
										model.setUseBatch(false);
									},
									error: function(error){
										reject(error);
										model.setUseBatch(false);
									}
								});
							});	
						}),
						
						getPromotionTypeSetAndPurchasingGroupSet : function(masterDataSystem){
							return this._getPromotionTypeSetAndPurchasingGroupSet(masterDataSystem, false);
						},

						readLeadingCategoriesSet: function(masterDataSystem) {
							return new Promise(function(resolve, reject) {
								var oParams = {
									"$filter": "MasterdataSystem eq '" + masterDataSystem + "'"
								};
								this.read("/LeadingCategories", oParams, function(oData){
									var aLeadingCategories = oData.results || [];
									resolve(aLeadingCategories);
								});
							}.bind(this));
						},

						getLeadingCategoriesSet: function(masterDataSystem) {	
							// Check if we have it in cache. If not create new Promise
							if (!leadingCategoriesCache.hasOwnProperty(masterDataSystem)) {
								leadingCategoriesCache[masterDataSystem] = this.readLeadingCategoriesSet(masterDataSystem);
							}
							
							return leadingCategoriesCache[masterDataSystem];
						},
						
						getPromotionTypeSet: function(masterDataSystem) {
							return this.getDataSet("PromotionTypeSet", "/PromotionTypes", {}, masterDataSystem, false);
						},

						getPurchasingGroupSet: withCache(function(masterDataSystem) {
							var params = {
									EntityType: "'Offer'",
									PropertyName: "'PurchasingGroup'",
									MasterdataSystem: "'" + masterDataSystem + "'"
								};
							return this.read("/GetHelpValues", params, function(data) {
								return data.results || [];
							});
						}, function(masterDataSystem) {
							return [masterDataSystem];
						}),

						getTactics: function () {
							function tacticsMapper (oTactic){
								return {
									Name : oTactic.TacticTypeDesc + "/" + oTactic.TacticDesc,
									Id : oTactic.TacticType + "/" + oTactic.TacticId,
									TacticId : oTactic.TacticId,
									TacticType : oTactic.TacticType,
									TacticDesc : oTactic.TacticDesc,
									TacticTypeDesc : oTactic.TacticTypeDesc,
									OfferId : oTactic.OfferId || ""
								};
							}
							var initialData = this.getInitialData();
							if (initialData.Tactics) {
								return Promise.resolve(initialData.Tactics).then(function(result) {
									return result.map(tacticsMapper);
								});
							} else {
								return this.read("/Tactics", null, function (data) {
									initialData.Tactics = data.results;
									return initialData.Tactics.map(tacticsMapper);
								});
							}
						},
						updateOffers: function(result, aSelOffers, aSelItems) {
							return new Promise(function(resolve, reject){
								var oModel = Models.getServiceModel();
								oModel.setUseBatch(true);
								oModel.setDeferredGroups(["batchCalls"]);
								for(var i = 0; i < aSelItems.length; i++) {
									var sPath = aSelItems[i].getBindingContextPath();
									var obj = jQuery.extend({}, true, result);
									obj.ChangedOn = aSelOffers[i].ChangedOn;
									obj.OfferId =  aSelOffers[i].OfferId;
									oModel.update(sPath, obj, { groupId: "batchCalls" });									
								}
								oModel.submitChanges({
									groupId: "batchCalls", 
									success: function(data){
										resolve(data);
										oModel.setUseBatch(false);
									},
									error: function(error){
										reject(error);
										oModel.setUseBatch(false);
									}});
							});							
						},
						getOffer: function(offer) {
							this._offerId =  Utils.base64ToHex(offer.OfferId);
							var filter = {
									"$expand": "Terms"
							};
							return this.read("/Offers(binary'" + Utils.base64ToHex(offer.OfferId) + "')", filter, function(oReturnedData){
								return {
									data : oReturnedData || {}
								};
							});
						},
						
						deleteOffers : function(aOfferIds){
							var oModel = this.getServiceModel();
							
							//Set model
							oModel.setUseBatch(true);
							oModel.setRefreshAfterChange(false);
							
							//Perform batch call - each delete operation is in a separate change set
							var sGroupId = jQuery.sap.uid();
							
							//Store group ID
							var aGroups = oModel.getDeferredGroups();
							aGroups = aGroups.concat([ sGroupId ]);
							oModel.setDeferredGroups(aGroups);
							
							aOfferIds.map( function(sId) {
								oModel.remove("/Offers(binary'" + sId + "')", {
									groupId : sGroupId,
									changeSetId : jQuery.sap.uid()
								});
							});
							
							return new Promise(function(resolve, reject) {
								oModel.submitChanges({
									groupId : sGroupId,
									success : function(oReturnedData, oResponse){
										oModel.setUseBatch(false);
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : function(oError) {
										oModel.setUseBatch(false);
										reject(oError);
									}
								});
							});
						},
						
						getOffersActions: function(aOffers, sArea) {
							var oModel = this.getServiceModel();
							oModel.setUseBatch(true);
							
							var sGroupId = jQuery.sap.uid();
							
							//Store group ID
							var aGroups = oModel.getDeferredGroups();
							aGroups = aGroups.concat([ sGroupId ]);
							oModel.setDeferredGroups(aGroups);
							
							var params = {
								OfferId: null,
								Area: sArea
							};
							
							aOffers.forEach( function(oOffer) {
								params.OfferId = Utils.base64ToHex(oOffer.OfferId);
								oModel.callFunction("/GetActions", { 
									groupId: sGroupId, 
									urlParameters: params,
									changeSetId : jQuery.sap.uid()
								});
							});
							
							return new Promise(function(resolve, reject) {
								oModel.submitChanges({
									groupId: sGroupId, 
									success: function(oReturnedData){
										var results = oReturnedData.__batchResponses;
										results = results.map(function(oItem) {
											return oItem.data.results;
										});
										resolve({
											data : results
										});
										oModel.setUseBatch(false);
									},
									error: function(error){
										reject(error);
										oModel.setUseBatch(false);
									}
								});
							});	
						},
                        // support mass offer transfer only when backend change has applied
						executeMassOfferTransfer: function(aOffers) {
							var model = this.getServiceModel();
							var aVersions = [];
							aOffers.forEach(function (ofr) {
								aVersions.push({
									OfferId: ofr.OfferId,
								    ExtOfferId: ofr.ExtOfferId,
								    MasterdataSystem: ofr.MasterdataSystem
								});
							});
							var payload =
							 {
							 	"OfferId": aOffers[0].OfferId, 
							 	"Status": "98",
								"Versions": aVersions
							 };	
							return new Promise(function(resolve, reject) {
								model.create("/Offers", payload, {
									async : true,
									success : function(oReturnedData, oResponse){
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : reject
								});
							});
						},
						
						getExecuteOffersActions: function(aOffers, sAction, sArea) {
							var oModel = this.getServiceModel();
							
							//Set model
							oModel.setUseBatch(true);
							oModel.setRefreshAfterChange(false);
							
							//Perform batch call - each delete operation is in a separate change set
							var sGroupId = jQuery.sap.uid();
							
							//Store group ID
							var aGroups = oModel.getDeferredGroups();
							aGroups = aGroups.concat([ sGroupId ]);
							oModel.setDeferredGroups(aGroups);
							
							var oParams = {
								OfferId: null,
								Action: sAction,
								Area: sArea
							};
							
							aOffers.map(function(oOffer) {
								oParams.OfferId = Utils.base64ToHex(oOffer.OfferId);
								oModel.callFunction("/ExecuteAction", {
									urlParameters: oParams,
									groupId: sGroupId,
									changeSetId : jQuery.sap.uid()
									});
								});
							
							return new Promise(function(resolve, reject) {
								oModel.submitChanges({
									groupId : sGroupId,
									success : function(oReturnedData, oResponse){
										oModel.setUseBatch(false);
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : function(oError) {
										oModel.setUseBatch(false);
										reject(oError);
									}
								});
							});
						},
						
						getNewOfferStatuses: function(binary){
							var params = {};
							if (binary) {
								params.OfferId = "binary'" + binary + "'";
							}
							params.Area = "'S'";
							//Prevent caching of the result in browser
							params.random = Utils.guid();
							return this.read("/GetActions", params, function(statusData){
								var statuses = statusData.results.map(function(item){
									return {
										Key : item.Status,
										Value : item.StatusName
									};
								});
								return statuses;
							});
						},
						
						getSearchHelpLocationPicker: function(masterdataSystem, propertyName, suggestedValue){
							var params = {
									EntityType: "'Term'",
									PropertyName: "'" + propertyName + "'",
									MasterdataSystem: "'" + masterdataSystem + "'"
							}; 
							return this.read("/GetHelpValues", params, function(oReturnedData){
								var toReturn = oReturnedData.results.filter(function(item){
									return item.Value.toLowerCase().indexOf(suggestedValue.toLowerCase()) > -1 ? true : false;
								});

								return {
									data : toReturn
								};
							});
						},

						getLocations: function(sPath, params) {
							return this.read(sPath, params, function(oReturnedData){
								return {
									data : oReturnedData.results
								};
							});
						},

						getLocationSuggestions: function(masterdataSystem, basicSearch) {
							var top = 10;
							var sDataSetPath = "/LocationHierarchyNodes";
							var params = {
									$filter: "MasterdataSystem eq '" + masterdataSystem + "'",
									$top: top
								};
							if(basicSearch){
								params.search = basicSearch;
							}
							return this.getLocations(sDataSetPath, params);							
						},

						getLocationFiltered: function(masterdataSystem, filters, basicSearch, expandLoc, expandCA){
							var sDataSetPath = "/LocationHierarchyNodes";
							var params = {};
							if (basicSearch){
								params.search = basicSearch;
							} 
							params.$filter = "MasterdataSystem eq '" + masterdataSystem + "'" + (filters ? " and " + filters : "");
							if(expandLoc) {
								params.$expand = "Locations";	
							}
							if(expandCA) {
								params.$expand = (params.$expand ?  params.$expand + "," : "") + "Locations/CustomAttributes";	
							}
							
							return this.read(sDataSetPath, params, function(oReturnedData){
								return {
									data : oReturnedData.results
								};
							});
						},
						searchTermsObjects : function(skip, top, filters, noPricesInCall, withUoMs){
							var initialFilters = jQuery.extend([],filters);
							var model = this.getServiceModel();
							if(noPricesInCall){
								initialFilters.unshift({"Id":0,"Attribute":"NO_PRICE","Sign":"I","Option":"EQ","Low":"X"});
							}
							
							var payload = {
								"Action": "Search",
								"TermObjects": [ { "Id": "", "Dimension":"", "ProductDetail": {"Id": "", "Dimension":""} } ],
								"Filters": initialFilters || []
							};
							if(withUoMs) {
								payload.TermObjects[0].UnitOfMeasures = [{}];
							}
							if(skip !== null){
								payload.Skip = skip;
							}
							if(top !== null){
								payload.Top = top;
							}
							
							var endpoint = "/TermObjectSearches";
							return new Promise(function(resolve, reject){
								model.create(endpoint, payload, {
							   		async: true,
						   			success : resolve,
									error : reject
								});
							}).then(function(data){
								if(!data.TermObjects){
									data.TermObject = [];
								}
								return data;
							});
						},
						fetchProductsByExternalIds : function(masterdataSystem, ids){
							var model = this.getServiceModel();
							var filters = ids.map(function(id, index){
								return { "Id": index ,"Attribute":"ExtId","Sign":"I","Option":"EQ","Low": id };
							});
							//product dimension
							filters.push({"Id":filters.length, "Attribute":"PROD_DIM_TCD", "Sign":"I", "Option":"EQ", "Low":"01"});
							//masterdataSystem
							filters.push({"Id":filters.length, "Attribute":"MD_SYSTEM_REF", "Sign":"I", "Option":"EQ", "Low":masterdataSystem});
							//'no prices' optimization
							filters.push({"Id":filters.length, "Attribute":"NO_PRICE", "Sign":"I", "Option":"EQ", "Low":"X"});
							
							//no ids -> no import
							if(!ids || ids.length === 0){
								return Promise.resolve( [] );
							}
							
							return new Promise(function(resolve, reject){
								model.create("/TermObjectSearches", {
									"Action": "Search",
									"TermObjects": [ { "Id": "" } ],
									"Filters": filters
								}, {
							   		async: true,
						   			success : function(data){
						   				var result = [];
						   				if(data.TermObjects){
						   					result = data.TermObjects.results; 
						   				}
						   				resolve(result);
						   			},
									error : reject
								});
							});
						
						},
						batchCallsOffersTwoOperations: function(payload, call, aPath, isProductGroup) {
							var tModel = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								tModel.setUseBatch(true);
								tModel.setRefreshAfterChange(false);
								tModel.setDeferredGroups(["batchCalls"]);
								tModel.create(call,null, { groupId: "batchCalls" });
								var uri = isProductGroup ? "/ProductGroups" : "/Offers";
								tModel.create(uri, payload, { 
									groupId: "batchCalls"
								});
								
								tModel.submitChanges({
									groupId: "batchCalls", 
									success: function(oReturnedData) {
										var results = Utils.get(oReturnedData, aPath);
										resolve({
											data : results || [],
											returnedData: oReturnedData
										});
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									},
									error: function(oError){
										reject(oError);
										tModel.setUseBatch(false);
										tModel.setRefreshAfterChange(true);
									}
								});				
							});
						},
						
						getFinancials : function(payload){
							var aPath = ["__batchResponses", 0, "__changeResponses", 1];
							return this.batchCallsOffersTwoOperations(payload, "/Simulate", aPath);
							
						},
						
						getProductsInPG : function(payload){
							var aPath = ["__batchResponses", 0, "__changeResponses", 1];
							return this.batchCallsOffersTwoOperations(payload, "/Simulate", aPath, true);
							
						},
						
						createNewProductGroup : function(savePayload) {
							var model = this.getServiceModel();
							return new Promise(function(resolve, reject) {
								model.create("/ProductGroups", jQuery.extend({}, savePayload), {
									async : true,
									success : function(oReturnedData, oResponse){
										resolve({
											data : oReturnedData,
											response: oResponse
										});
									},
									error : reject
								});
							});
						},
						
						getForecast : function(payload){
							var aPath = ["__batchResponses", 0, "__changeResponses", 1];
							return this.batchCallsOffersTwoOperations(payload, "/Forecast", aPath);
						},
						
						getTermObjectAttributes : withCache(function(){
							var params = {
								$filter: "Object eq '02' and AttributeType eq '01'"
							};
							return this.read("/Attributes", params, function(data){
								if(data.results){
									return data.results;
								}
								return [];
							});
						}),

						/**
						 * Searches target group(s) by name.
						 *
						 * @param {string} sAction The action to perform for filtering the name.
						 * @param {string} sName The name to use when filtering.
						 * @returns {object} A promise
						 */
						getTargetGroups: function(sAction, sName) {
							var params = {};
							switch (sAction) {
								case "contains":
									params = {
										$top: 10,
										$filter: "startswith(Name,'" + sName + "')"
									};
									break;
								case "equals":
									params = {
										$top: 1,
										$filter: "Name eq '" + sName + "'"
									};
									break;
							}

							return this.read("/TargetGroups", params, function(data){
								return {
						 			TargetGroups : data.results
								};
							});
						},
						
						getTermPrefixOptions : function(){
							var initialData = this.getInitialData();
							return Promise.resolve({
								BuyOptions : initialData.WhenOptions,
								GetOptions : initialData.GetOptions
							});
						},

						getPriceTypes: function() {
							return Promise.resolve(this.getInitialData().PriceTypes);
						},
						
						getProductTypes: function() {
							return Promise.resolve(this.getInitialData().ProductTypes);
						},						
						getForecastConfidence: function() {
							return this.getInitialData().ForecastConfidence;
						},
						getWeeks: function() {
							return Promise.resolve(this.getInitialData().Weeks);
						},
						getCoupons: function(masterdataSystem, key, dimension, type, filters){
							var endPoint = "/TermObjects?";

							var search = function nameFilter(sKey){
								return (sKey ? sKey + "*" : "");
							};
							var masterDataSystemFilter = function(system){
								return "MasterdataSystem eq '" + system + "'";
							};

							var dimensionFilter = function dimensionFilter(dim){
								return (dim ? " and Dimension eq '" + dim + "'" : "");
							};
							
							var typeFilter = function(sType){
								return (sType ? " and Type eq '" + sType + "'" : "");
							};
							
							var advancedFilters = filters ? " and " + filters : "";
							
							var params = {
								search: search(key),
								$filter: masterDataSystemFilter(masterdataSystem)
									+ dimensionFilter(dimension)
									+ typeFilter(type)
									+ advancedFilters,
								$expand: "ProductDetail"
							};
							return this.read(endPoint, params, function(data){
								return {
						 			Coupons : data.results
								};
							});
						},
						
						
						getTermAttributes : withCache(function(dimension, type){
							return this.read("/Attributes", {
								"$filter" : "Object eq '" + dimension + "' and AttributeType eq '" + type + "'"
							}, function(data){
								return {
									data : data.results.map(function(attributeItem){
										return {label:attributeItem.AttributeDesc,key:"AttributeId",id:attributeItem.AttributeId, object : attributeItem.Object, type: attributeItem.AttributeType};
									})
								};
							});
						}),
						withRetry : function(retryCount, ctx, fn){

							function delay(timeout){
								return new Promise(function(resolve){
									setTimeout(function(){
										resolve();
									}, timeout);
								});
							}
							
							function retry(fn, args, ctx, timeout, times) {
								return fn.apply(ctx, args).then(function(result){
							    	return result;
							    }, function (error) {
							    	if (times === 0){
							            throw error;
							        }
							    	return delay(timeout).then(function() {
							            return retry(fn, args, ctx, timeout, times - 1);
							        });
							    });
							}
							
							return function retryingFunction(/*...arguments*/){
								return retry(fn, arguments, ctx, 1000, retryCount);
							};
						},
						
						getPurposes: function() {
							return Promise.resolve(initialData.Purpose);
						},
						
						getLocationSubgroups: function(payload) {
							var params = {
								$filter: "HierarchyId eq '" + payload.HierarchyId + "'"
							};
							return this.read("/LocationSubgroups", params, function(data){
								return data.results || [];
							});
						},
						
						getReferenceEvent: function(id) {
							var params = {
								$filter: "Id eq '" + id + "'"
							};
							return this.read("/Events", params, function(data){
								return data.results || [];
							});
						},
						
						getMarketingArea: function(id) {
							var params = {
								$filter: "MKT_AREA_ID eq '" + id + "'"	
							};
							return this.read("/SH_H_DMF_MKT_AREA_H", params, function(data) {
								return data.results || [];
							});
						},
						
						setInitialData: function(data) {
							//Used in unit tests to mock data
							initialData = data;
						},
						
						getCouponOffers: function(key, select, filters) {
							var searchStr = key ?  key : "";
							var sIsCouponOffer = (select === "O01") ? "true" : "false";
							var isCouponOfferFilter = "IsCouponOffer eq " + sIsCouponOffer;
							var advancedFilters = filters ? " and " + filters : "";
							
							var params = {
								search: "COUPONOFFER" + searchStr,
								$filter: isCouponOfferFilter + advancedFilters
							};
							return this.read("/Offers", params, function(data){
								return  data.results || [];
							});
						},
						
						getCouponOfferById: function(offerId) {
						    
							var couponOfferFilter = function() {
								return " IsCouponOffer eq true ";
							};
							var params = {
								$filter: couponOfferFilter()
							};							
							
							return this.read("/Offers(binary'" + Utils.base64ToHex(offerId) + "')", params, function(data){
								return  data || {};
							});
						},		
					};

					/*
					 * Generate all value help method based on config
					 */
					ProductSearchValueHelpEndPoints.forEach(function(productValueHelp){
						Models[productValueHelp.methodName] = withCache(Models.valueHelp(productValueHelp.entityName, productValueHelp.masterdataSystemIndependent), function(masterDataSystem){
							return [masterDataSystem || "masterdataSystemIndependent"];
						});
					});

					return Models;
				}, /* bExport= */true);
