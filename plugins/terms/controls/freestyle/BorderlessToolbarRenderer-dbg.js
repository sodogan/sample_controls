/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/ToolbarRenderer"], function(ToolbarRenderer) {
	"use strict";

	/**
	 * BorderlessToolbarRenderer renderer
	 * @namespace
	 */
	var BorderlessToolbarRenderer = {};

	/**
	 * Renders the HTML for the given control, using the provided {@link sap.ui.core.RenderManager}.
	 *
	 * @param {sap.ui.core.RenderManager} renderManager the RenderManager that can be used for writing to the render output buffer
	 * @param {sap.ui.core.Control} control an object representation of the control that should be rendered
	 */
	BorderlessToolbarRenderer.render = function(){
		return ToolbarRenderer.render.apply(ToolbarRenderer, arguments);
	};

	return ToolbarRenderer;

}, /* bExport= */ true);