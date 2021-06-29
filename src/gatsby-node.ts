import { CreateNodeArgs, Node, ParentSpanPluginArgs, PluginOptions } from "gatsby";
import { camelCase, isArray, isFunction, isPlainObject, isString, upperFirst } from "lodash";
import { basename} from "path";

export function unstable_shouldOnCreateNode({ node }: { node: Node}) {
  // We only care about JSON content.
  return node.internal.mediaType === `application/json`
}

export async function onCreateNode(args: CreateNodeArgs, pluginOptions: PluginOptions) {
  const { node, actions, loadNodeContent, createNodeId, createContentDigest, reporter }= args;
  if (!unstable_shouldOnCreateNode({ node })) {
    return
  }

  function getType({ node, object, isArray }) {
    if (pluginOptions && isFunction(pluginOptions.typeName)) {
      return pluginOptions.typeName({ node, object, isArray })
    } else if (pluginOptions && isString(pluginOptions.typeName)) {
      return pluginOptions.typeName
    } else if (node.internal.type !== `File`) {
      return upperFirst(camelCase(`${node.internal.type} Json`))
    } else if (isArray) {
      return upperFirst(camelCase(`${node.name} Json`))
    } else {
      return upperFirst(camelCase(`${basename(node.dir)} Json`))
    }
  }

  function transformObject(obj: any, id: string, type: string) {
    const jsonNode = {
      ...obj,
      id,
      children: [],
      parent: node.id,
      internal: {
        contentDigest: createContentDigest(obj),
        type,
      },
    }
    createNode(jsonNode)
    createParentChildLink({ parent: node, child: jsonNode })
  }

  function createCustomObject(obj: any) {
    if (isString(obj.type) && isPlainObject(obj.module)) {
      reporter.verbose(`Got object of ${obj.type}`);
      const type = upperFirst(camelCase(obj.type + " Doc"));
      const jsonNode: Node = {
        ...obj.module,
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
      createParentChildLink({parent: node, child: jsonNode})
      return true;
    }
    return false;
  }

  function createObject(obj: any, id: string, type: string) {
    if (!createCustomObject(obj)) {
      transformObject(obj, id, type);
    }
  }

  const { createNode, createParentChildLink } = actions

  const content = await loadNodeContent(node)
  let parsedContent
  try {
    parsedContent = JSON.parse(content)
  } catch {
    const hint = node.absolutePath
      ? `file ${node.absolutePath}`
      : `in node ${node.id}`
    throw new Error(`Unable to parse JSON: ${hint}`)
  }

  if (isArray(parsedContent)) {
    parsedContent.forEach((obj, i) => {
      transformObject(
        obj,
        obj.id ? String(obj.id) : createNodeId(`${node.id} [${i}] >>> JSON`),
        getType({ node, object: obj, isArray: true })
      )
    })
  } else if (isPlainObject(parsedContent)) {
    createObject(
      parsedContent,
      parsedContent.id
        ? String(parsedContent.id)
        : createNodeId(`${node.id} >>> JSON`),
      getType({ node, object: parsedContent, isArray: false })
    )
  }
}
