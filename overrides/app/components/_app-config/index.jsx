/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import React from 'react'
import PropTypes from 'prop-types'
import {ChakraProvider} from '@salesforce/retail-react-app/app/components/shared/ui'

// Removes focus for non-keyboard interactions for the whole application
import 'focus-visible/dist/focus-visible'

import theme from '@salesforce/retail-react-app/app/theme'
import {MultiSiteProvider, StoreLocatorProvider} from '@salesforce/retail-react-app/app/contexts'
import {
    resolveSiteFromUrl,
    resolveLocaleFromUrl
} from '@salesforce/retail-react-app/app/utils/site-utils'
import {getConfig} from '@salesforce/pwa-kit-runtime/utils/ssr-config'
import {proxyBasePath} from '@salesforce/pwa-kit-runtime/utils/ssr-namespace-paths'
import {createUrlTemplate} from '@salesforce/retail-react-app/app/utils/url'
import createLogger from '@salesforce/pwa-kit-runtime/utils/logger-factory'

import {CommerceApiProvider} from '@salesforce/commerce-sdk-react'
import {withReactQuery} from '@salesforce/pwa-kit-react-sdk/ssr/universal/components/with-react-query'
import {useCorrelationId} from '@salesforce/pwa-kit-react-sdk/ssr/universal/hooks'
import {getAppOrigin} from '@salesforce/pwa-kit-react-sdk/utils/url'
import {ReactQueryDevtools} from '@tanstack/react-query-devtools'
import {
    DEFAULT_DNT_STATE,
    STORE_LOCATOR_RADIUS,
    STORE_LOCATOR_RADIUS_UNIT,
    STORE_LOCATOR_DEFAULT_COUNTRY,
    STORE_LOCATOR_DEFAULT_COUNTRY_CODE,
    STORE_LOCATOR_DEFAULT_POSTAL_CODE,
    STORE_LOCATOR_DEFAULT_PAGE_SIZE,
    STORE_LOCATOR_SUPPORTED_COUNTRIES
} from '@salesforce/retail-react-app/app/constants'

/**
 * Use the AppConfig component to inject extra arguments into the getProps
 * methods for all Route Components in the app – typically you'd want to do this
 * to inject a connector instance that can be used in all Pages.
 *
 * You can also use the AppConfig to configure a state-management library such
 * as Redux, or Mobx, if you like.
 */
const AppConfig = ({children, locals = {}}) => {
    const {correlationId} = useCorrelationId()
    const headers = {
        'correlation-id': correlationId
    }

    const commerceApiConfig = locals.appConfig.commerceAPI

    const appOrigin = getAppOrigin()

    const passwordlessCallback = locals.appConfig.login?.passwordless?.callbackURI

    const storeLocatorConfig = {
        radius: STORE_LOCATOR_RADIUS,
        radiusUnit: STORE_LOCATOR_RADIUS_UNIT,
        defaultCountry: STORE_LOCATOR_DEFAULT_COUNTRY,
        defaultCountryCode: STORE_LOCATOR_DEFAULT_COUNTRY_CODE,
        defaultPostalCode: STORE_LOCATOR_DEFAULT_POSTAL_CODE,
        defaultPageSize: STORE_LOCATOR_DEFAULT_PAGE_SIZE,
        supportedCountries: STORE_LOCATOR_SUPPORTED_COUNTRIES
    }

    return (
        <CommerceApiProvider
            shortCode={commerceApiConfig.parameters.shortCode}
            clientId={commerceApiConfig.parameters.clientId}
            organizationId={commerceApiConfig.parameters.organizationId}
            siteId={locals.site?.id}
            locale={locals.locale?.id}
            currency={locals.locale?.preferredCurrency}
            redirectURI={`${appOrigin}/callback`}
            proxy={`${appOrigin}${commerceApiConfig.proxyPath}`}
            headers={headers}
            defaultDnt={DEFAULT_DNT_STATE}
            logger={createLogger({packageName: 'commerce-sdk-react'})}
            passwordlessLoginCallbackURI={passwordlessCallback}
        >
            <MultiSiteProvider site={locals.site} locale={locals.locale} buildUrl={locals.buildUrl}>
                <StoreLocatorProvider config={storeLocatorConfig}>
                    <ChakraProvider theme={theme}>{children}</ChakraProvider>
                </StoreLocatorProvider>
            </MultiSiteProvider>
            <ReactQueryDevtools />
        </CommerceApiProvider>
    )
}

AppConfig.restore = (locals = {}) => {
    const path =
        typeof window === 'undefined'
            ? locals.originalUrl
            : `${window.location.pathname}${window.location.search}`
    const site = resolveSiteFromUrl(path)
    const locale = resolveLocaleFromUrl(path)

    const {app: appConfig} = getConfig()
    const apiConfig = {
        ...appConfig.commerceAPI,
        einsteinConfig: appConfig.einsteinAPI
    }

    apiConfig.parameters.siteId = site.id

    locals.buildUrl = createUrlTemplate(appConfig, site.alias || site.id, locale.id)
    locals.site = site
    locals.locale = locale
    locals.appConfig = appConfig
}

AppConfig.freeze = () => undefined

AppConfig.extraGetPropsArgs = (locals = {}) => {
    return {
        buildUrl: locals.buildUrl,
        site: locals.site,
        locale: locals.locale
    }
}

AppConfig.propTypes = {
    children: PropTypes.node,
    locals: PropTypes.object
}

const isServerSide = typeof window === 'undefined'

// Recommended settings for PWA-Kit usages.
// NOTE: they will be applied on both server and client side.
// retry is always disabled on server side regardless of the value from the options
const options = {
    queryClientConfig: {
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                staleTime: 10 * 1000,
                ...(isServerSide ? {retryOnMount: false} : {})
            },
            mutations: {
                retry: false
            }
        }
    }
}

export default withReactQuery(AppConfig, options)
