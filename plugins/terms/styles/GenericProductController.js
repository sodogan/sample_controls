/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/plugins/terms/styles/ProductHierarchyController","retail/pmr/promotionaloffers/plugins/terms/styles/ProductController"],function(P,a){function G(m,p,d){P.call(this,m,p);this.dimension=d;}G.prototype=Object.create(P.prototype);G.prototype.getDimension=function(){return this.dimension;};G.prototype.openValueHelpDialog=function(e,m){return a.openValueHelpDialog(m,this.dimension);};G.prototype.populateModel=function(m,p,d){return a.prototype.populateModel.call(this,m,p,d);};return G;},true);
