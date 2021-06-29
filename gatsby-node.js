"use strict";

exports.__esModule = true;
exports.unstable_shouldOnCreateNode = unstable_shouldOnCreateNode;
exports.onCreateNode = onCreateNode;

var _lodash = require("lodash");

var _path = require("path");

function unstable_shouldOnCreateNode({
  node
}) {
  // We only care about JSON content.
  return node.internal.mediaType === `application/json`;
}

async function onCreateNode(args, pluginOptions) {
  const {
    node,
    actions,
    loadNodeContent,
    createNodeId,
    createContentDigest,
    reporter
  } = args;

  if (!unstable_shouldOnCreateNode({
    node
  })) {
    return;
  }

  function getType({
    node,
    object,
    isArray
  }) {
    if (pluginOptions && (0, _lodash.isFunction)(pluginOptions.typeName)) {
      return pluginOptions.typeName({
        node,
        object,
        isArray
      });
    } else if (pluginOptions && (0, _lodash.isString)(pluginOptions.typeName)) {
      return pluginOptions.typeName;
    } else if (node.internal.type !== `File`) {
      return (0, _lodash.upperFirst)((0, _lodash.camelCase)(`${node.internal.type} Json`));
    } else if (isArray) {
      return (0, _lodash.upperFirst)((0, _lodash.camelCase)(`${node.name} Json`));
    } else {
      return (0, _lodash.upperFirst)((0, _lodash.camelCase)(`${(0, _path.basename)(node.dir)} Json`));
    }
  }

  function transformObject(obj, id, type) {
    const jsonNode = { ...obj,
      id,
      children: [],
      parent: node.id,
      internal: {
        contentDigest: createContentDigest(obj),
        type
      }
    };
    createNode(jsonNode);
    createParentChildLink({
      parent: node,
      child: jsonNode
    });
  }

  function createCustomObject(obj) {
    if ((0, _lodash.isString)(obj.type) && (0, _lodash.isPlainObject)(obj.module)) {
      reporter.verbose(`Got object of ${obj.type}`);
      const type = (0, _lodash.upperFirst)((0, _lodash.camelCase)(obj.type + " Doc"));
      const jsonNode = { ...obj.module,
        id: createNodeId(`${node.id} ${obj.type}`),
        parent: node.id,
        children: [],
        internal: {
          contentDigest: createContentDigest(obj),
          type,
          owner: ""
        }
      };
      createNode(jsonNode);
      createParentChildLink({
        parent: node,
        child: jsonNode
      });
      return true;
    }

    return false;
  }

  function createObject(obj, id, type) {
    if (!createCustomObject(obj)) {
      transformObject(obj, id, type);
    }
  }

  const {
    createNode,
    createParentChildLink
  } = actions;
  const content = await loadNodeContent(node);
  let parsedContent;

  try {
    parsedContent = JSON.parse(content);
  } catch {
    const hint = node.absolutePath ? `file ${node.absolutePath}` : `in node ${node.id}`;
    throw new Error(`Unable to parse JSON: ${hint}`);
  }

  if ((0, _lodash.isArray)(parsedContent)) {
    parsedContent.forEach((obj, i) => {
      transformObject(obj, obj.id ? String(obj.id) : createNodeId(`${node.id} [${i}] >>> JSON`), getType({
        node,
        object: obj,
        isArray: true
      }));
    });
  } else if ((0, _lodash.isPlainObject)(parsedContent)) {
    createObject(parsedContent, parsedContent.id ? String(parsedContent.id) : createNodeId(`${node.id} >>> JSON`), getType({
      node,
      object: parsedContent,
      isArray: false
    }));
  }
}