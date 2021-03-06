import { Graph, identifyFiletype } from "rdfoo";
import Identity from "./Identity";
import ActionResult, { actionResultAbort } from "../actions/ActionResult";
import { text } from "../output/output";
import IdentityFactory, { Existence } from "./IdentityFactory";
import { SBOLVersion } from "../util/get-sbol-version-from-graph";
import joinURIFragments from "../util/join-uri-fragments";
import { SBOL3GraphView, S1Facade, S1DnaComponent, sbol3 } from "sbolgraph";
import { Predicates } from "bioterms";
import { strict as assert } from 'assert'
import { identityErrorGeneric, identityErrorUnguessableNamespace, identityErrorChildIdentityMissingContext, identityErrorEmptyChain } from "./helpers/errors";
import { validateDisplayId, validateNamespaceIsPrefix } from "./helpers/validation";
import Chain from "./helpers/Chain";
import { trace } from "../output/print";

export default class IdentityFactorySBOL3 extends IdentityFactory {

    from_namespace_and_identity(
        existence:Existence, g:Graph, namespace:string, identity:string, version?:string):Identity
    {
        if (version) {
            throw sbol3VersionError()
        }

        if (Chain.isChain(identity)) {

            // Chain: can be top-level or child

            if(Chain.isEmpty(identity)) {
                throw identityErrorEmptyChain()
            }

            if(Chain.tokens(identity).length === 1) {

                return this.toplevel_from_namespace_displayId(
                    existence, g, namespace, Chain.displayId(identity) as string, undefined)
                
            } else {
                return this.child_from_namespace_context_displayId(
                    existence, g, namespace, Chain.context(identity) as string, Chain.displayId(identity) as string, undefined)
            }

        } else {

            // URI: has to be top-level

            validateNamespaceIsPrefix(namespace, identity)

            let displayId = identity.slice(namespace.length)

            return new Identity(SBOLVersion.SBOL3, namespace, displayId, undefined, undefined, identity)
        }
    }

    from_identity(
        existence:Existence, g:Graph, identity:string, version?:string):Identity
    {
        trace(text(`SBOL3 from_identity: identity ${identity}, version ${version}`))

        if (version) {
            throw sbol3VersionError()
        }

        if (Chain.isChain(identity)) {

            // Chain: can be top-level or child

            // No namespace supplied and identity is a chain
            // Infer the namespace from the graph?

            let prefixes = extractPrefixesFromGraphSBOL3(g)

            if(prefixes.length !== 1) {
                throw identityErrorUnguessableNamespace(prefixes)
            }

            return this.from_namespace_and_identity(existence, g, prefixes[0], identity, undefined)

        } else {

            // URI: has to be top-level

            // No namespace supplied and identity is a URI
            // Invent a namespace from the URI

            let namespace = inventUriPrefixSBOL3(identity)

            return this.from_namespace_and_identity(existence, g, namespace, identity, undefined)
        }
    }

    toplevel_from_displayId(
        existence:Existence, g:Graph, displayId:string, version?:string):Identity
    {
        trace(text(`SBOL3 toplevel_from_displayId: displayId ${displayId}, version ${version}`))

        if (version) {
            throw sbol3VersionError()
        }

        let prefixes = extractPrefixesFromGraphSBOL3(g)

        if(prefixes.length !== 1) {
            throw identityErrorUnguessableNamespace(prefixes)
        }

        return this.toplevel_from_namespace_displayId(existence, g, prefixes[0], displayId, undefined)

    }

    toplevel_from_namespace_displayId(
        existence:Existence, g:Graph, namespace:string, displayId:string, version?:string):Identity
    {
        trace(text(`SBOL3 toplevel_from_namespace_displayId: namespace ${namespace}, displayId ${displayId}, version ${version}`))

        if (version) {
            throw sbol3VersionError()
        }

        return new Identity(SBOLVersion.SBOL3, namespace, displayId, undefined, '', joinURIFragments([namespace, displayId]))
    }

    child_from_namespace_context_displayId(
        existence:Existence, g:Graph, namespace:string, contextIdentity:string, displayId:string, version?:string):Identity
    {
        if (version !== undefined) {
            throw sbol3VersionError()
        }

        let context = this.from_namespace_and_identity(Existence.MustExist, g, namespace, contextIdentity, undefined)
        assert(context.namespace === namespace)

        // base case TL:C = context is a top level
        // recursive case C:C = context is a child
        // who cares context is a shit that has a shitting uri

        let parent = sbol3(g).uriToFacade(context.uri)

        let children: S1Facade[] = []
        if (parent instanceof S1DnaComponent) {
            children = children.concat(parent.annotations)
            children = children.concat(parent.subComponents)
        }

        let match = children.filter((child) => child.getStringProperty(Predicates.SBOL3.displayId) === displayId)[0]

        // TODO: does supplied version match object?

        return this.from_namespace_and_identity(existence, g, namespace, match.uri, version)
    }

    child_from_context_displayId(existence:Existence, g: Graph, contextIdentity: string, displayId: string, version?: string): Identity {

        if (version !== undefined) {
            throw sbol3VersionError()
        }

        let context = this.from_identity(Existence.MustExist, g, contextIdentity, undefined)

        let parent = sbol3(g).uriToFacade(context.uri)

        if(!parent) {
            throw actionResultAbort(text(`Context object with identity ${contextIdentity} not found`))
        }

        let children: S1Facade[] = []
        if (parent instanceof S1DnaComponent) {
            children = children.concat(parent.annotations)
            children = children.concat(parent.subComponents)
        }

        let match = children.filter((child) => child.getStringProperty(Predicates.SBOL3.displayId) === displayId)[0]

        return this.from_namespace_and_identity(existence, g, context.namespace, match.uri, version)
    }
    
}

function sbol3VersionError() {
    return actionResultAbort(text(`Version is only supported in SBOL2`))
}

function extractPrefixesFromGraphSBOL3(g:Graph) {

    return sbol3(g).namespaces.map(ns => ns.uri)

}

function inventUriPrefixSBOL3(uri:string) {
    let slash = uri.lastIndexOf('/')
    let hash = uri.lastIndexOf('#')
    if(slash !== -1) {
        return uri.slice(0, slash + 1)
    }
    if(hash !== -1) {
        return uri.slice(0, hash + 1)
    }
    return ''
}

