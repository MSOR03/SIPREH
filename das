[33mcommit 27e1c4d2749509cc71576999ca7079a0abeca762[m[33m ([m[1;31morigin/daniela[m[33m)[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Mon Mar 23 00:33:11 2026 -0500

    Diseño de salida grafica 2D de indices meteorologicos

[33mcommit 09b98156945b8c66ea494292f7b3bc3a752d76bd[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Wed Mar 18 00:00:59 2026 -0500

    Modfiicación de logo y nombre del Dashboard

[33mcommit 20a51716425429c145c7fc2439decdf750270d04[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 20:54:24 2026 -0500

    Ajuste de proporcionalidad espacial de sálida gráfica descargable de representación 2D de grados de sequía

[33mcommit c2904be792740ec6189d61969dff32e30a3cc98e[m
Merge: b93e325 a0038a8
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 17 17:49:02 2026 -0500

    Merge pull request #20 from MSOR03/main
    
    Merge main branch into daniela

[33mcommit a0038a828bd4835048daee5a659dde9cc721573e[m
Merge: 66749cc 61e45c5
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 17 17:47:16 2026 -0500

    Merge pull request #19 from MSOR03/molartera
    
    Merge molartera branch into main.

[33mcommit 61e45c5d5ed440fdc3e35826c49b20e92e1fc6f2[m
Merge: 550cc68 b93e325
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 17 17:45:26 2026 -0500

    Merge remote-tracking branch 'origin/daniela' into molartera

[33mcommit b93e3252ab6e61ed1682bd149e6f6a51e282b0ab[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 17:22:15 2026 -0500

    Ajustes de panel de coordenadas homogeneizando el estilo de visualización con la escala

[33mcommit 41f596a1a4ead296a4302a712e2980d047feb383[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 16:54:44 2026 -0500

    Ajustes de visualización de panel de coordenadas

[33mcommit 2c2fda6ed608cc8bb196729d6689f9692c5c579a[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 16:29:06 2026 -0500

    Inclusión de barra de coordenadas que marca localización dle cursor cuando el usuario realiza un bsuqueda

[33mcommit 884db7f13f04043d6be7f48c4c8f0c9cf4dd37fc[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 15:57:12 2026 -0500

    Ajuste de información que se despliega al colocar el pulsor sobre una celda

[33mcommit a4f756784a7014c4673bf4d3f564a71b03c9df01[m
Merge: 3119517 26766c6
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 13:45:10 2026 -0500

    Merge branch 'daniela' of https://github.com/MSOR03/DroughtMonitor into daniela

[33mcommit 311951767126fb176c2f9ecbdd838b29c7285145[m
Merge: 2ec3ec8 b819bdb
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 17 13:44:51 2026 -0500

    Resolve merge conflict in page.js

[33mcommit 550cc68474a12a15b802b2aa3816b5daca083e54[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 17 03:24:35 2026 -0500

    feat: Implement hydrological data querying and visualization
    
    - Added HydroTimeseriesMixin for querying hydrological time series data from parquet files.
    - Enhanced frontend to support hydrological indices (SDI, SRI, MFI, DDI, HDI) and their respective data retrieval.
    - Introduced DroughtEventTimeline component to visualize drought events with duration.
    - Updated LeafletMap to display hydrological stations and their data.
    - Modified Sidebar and HistoricalSection to include hydrological variables and indices.
    - Created hydroApi for fetching hydrological station data and time series.
    - Added utility functions for managing hydrological stations and indices.

[33mcommit 6aae9979d3bfa878093b19270f317beb3cc65046[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 17 00:50:08 2026 -0500

    feat: implement tiered storage strategy for parquet datasets
    
    - Added tiered storage service to manage parquet datasets based on size.
    - Introduced functions to resolve cloud keys, cache management, and background preloading of parquet files.
    - Updated historical data service to support multi-key parquet sources.
    - Enhanced API endpoints to utilize new tiered storage logic.
    - Implemented download functionality for files in the admin dashboard.
    - Removed unused logo files from the frontend.

[33mcommit 66749ccde62cf75bbe5735411de2e76a9a54a09b[m
Merge: f812b54 8be7406
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Sun Mar 15 22:35:53 2026 -0500

    Merge pull request #18 from MSOR03/molartera
    
    feat: Implement historical timeseries mixin for querying parquet data

[33mcommit 8be7406be18abb676d0da9525c1e4f534d30c258[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Sun Mar 15 22:34:43 2026 -0500

    feat: Implement historical timeseries mixin for querying parquet data
    
    - Added TimeseriesMixin class to handle historical timeseries queries with support for various formats and caching.
    - Enhanced query logic to dynamically determine frequency and handle edge cases for drought indices.
    - Improved error handling and logging for query execution.
    - Updated run.py to exclude certain file types from reload during development.
    - Removed unused recharts dependency from frontend package.json.
    - Modified page.js to include new state variables for index scale and frequency, and updated analysis plot handling.
    - Refactored MapArea component to optimize performance with memoization and callbacks.
    - Introduced DroughtLegend component for better rendering of drought categories.
    - Enhanced HistoricalSection to allow selection of temporal scale and frequency for analysis.
    - Updated API service to include scale and frequency parameters in historical data requests.

[33mcommit f812b5476921e14df5735064883f208b5c1e4d63[m
Merge: 13a535a 8016c28
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Sun Mar 15 01:54:04 2026 -0500

    Merge pull request #17 from MSOR03/molartera
    
    feat: Enhance dataset management features in frontend and backend

[33mcommit 8016c28ab399ec872a8cf9089858c2db71d6f831[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Sat Mar 14 21:49:37 2026 -0500

    feat: Enhance dataset management features in frontend and backend
    
    - Added resolution inference from filenames in historical data processing.
    - Implemented metadata extraction from parquet files without loading full content into memory.
    - Introduced dataset catalog loading and status checking in the frontend.
    - Created a new DatasetWorkflowCard component for managing dataset updates, including attaching files and executing merge-and-rollover operations.
    - Updated API service methods for dataset catalog retrieval, file attachment, dataset status fetching, and merge-and-rollover functionality.

[33mcommit 26766c6aae5b7b87d131d12a131d30a9fcc6310a[m
Merge: b819bdb 13a535a
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Sat Mar 14 17:32:17 2026 -0500

    Merge pull request #16 from MSOR03/main
    
    feat:Added  a feature to export JSON and image analysis.

[33mcommit 13a535a996aa31f69c16ac965395408ee05ef4ab[m
Merge: f79c3e1 1b93e67
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Sat Mar 14 17:29:06 2026 -0500

    Merge pull request #15 from MSOR03/molartera
    
    feat: implement JSON and image export functionality for analysis data

[33mcommit 1b93e67c26ca0ba219a8fc5247273293ac0fe7ba[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Sat Mar 14 17:26:06 2026 -0500

    feat: implement JSON and image export functionality for analysis data
    
    - Added downloadAnalysisJson and downloadAnalysisImage functions in utils/exporters.js to handle data export.
    - Integrated JSON export functionality in handleAnalysisSave, with user feedback for success and error cases.
    - Implemented image export functionality in handleAnalysisImageExport, providing visual representation of analysis data.
    - Updated MapArea component to include buttons for saving JSON and exporting images.
    - Removed unused save functionality from Sidebar, HistoricalSection, PredictionHistorySection, and PredictionSection components.
    - Enhanced UI elements for better user interaction and feedback during export processes.

[33mcommit 2ec3ec81ca1c8beba253c98981cb2abe7483d5e5[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Sat Mar 14 09:56:00 2026 -0500

    Ajustes de leyendas y visualización de grados de severidad de sequia

[33mcommit b819bdb474559a98a66a9d8dbff21116acb1558c[m
Merge: 1781ee1 f79c3e1
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Fri Mar 13 17:23:36 2026 -0500

    Merge pull request #14 from MSOR03/main
    
    Merge main branch into daniela

[33mcommit f79c3e1b8be37b12aadfcdc2b7f5d7b90c28633f[m
Merge: c7b35f8 4ed0b71
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Fri Mar 13 17:22:05 2026 -0500

    Merge pull request #13 from MSOR03/molartera
    
    Merge daniela branch into molartera

[33mcommit 4ed0b713c0a573d267b721a180c594c61b0e8626[m
Merge: 77729de 1781ee1
Author: MSOR03 <molartera@unal.edu.co>
Date:   Fri Mar 13 17:20:17 2026 -0500

    Merge remote-tracking branch 'origin/daniela' into molartera

[33mcommit 1781ee1b2e115637a5db847f467c835ea4be8220[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Fri Mar 13 11:50:32 2026 -0500

    Ajustes de umbrales de sequía desde backend

[33mcommit ce22e3ec05801eb6abd3e1700126d13f8198ff21[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Fri Mar 13 11:37:57 2026 -0500

    Ajuste de umbrales de indices de sequia meterologica

[33mcommit c7b35f80dbbbee0413b1fcba1bc893e006316a3e[m
Merge: 370542c 77729de
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Fri Mar 13 02:33:08 2026 -0500

    Merge pull request #10 from MSOR03/molartera
    
    Merge pull request #9 from MSOR03/main

[33mcommit 77729dec76381a6c9fb76edca74badf535f2798b[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Fri Mar 13 02:25:30 2026 -0500

    feat: add user management section with create and edit functionality
    
    - Implemented UsersSection component for managing users, including creating and editing users.
    - Added form validation and success/error messages for user actions.
    - Integrated API calls for user listing, creation, and updating.
    - Created helper functions for formatting dates and bytes.
    - Developed HistoricalSection and PredictionSection components for historical data analysis and predictions.
    - Introduced reusable UI components such as CollapsiblePanel, StepSection, and RadioCard for better UI consistency.
    - Enhanced user experience with loading states and conditional rendering based on user actions.

[33mcommit be5d6c7b49912c81e5915bf79a6d7459a7945123[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Fri Mar 13 00:49:49 2026 -0500

    Ajuste de grados de severidad de los indices de sequia meteorlogica y ajuste de visaulización de leyenda para todos los indices

[33mcommit 370542cd610b830cd1b9afa248b2b5822890e5df[m[33m ([m[1;32mmain[m[33m)[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Thu Mar 12 23:56:56 2026 -0500

    feat: Added new sidebar design to improve the variables's manage and the admin interface was create with login and dashboard

[33mcommit 8c2c4ba09ba363a8faafc89d2e8b3ec1cb932fa2[m
Merge: 8b13937 7d8fd14
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 10 02:12:02 2026 -0500

    Merge pull request #11 from MSOR03/main
    
    The daniela's branch was updated.

[33mcommit 7d8fd14f753540ae0ef1d4fa481c6e9eddf685bf[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 10 01:42:49 2026 -0500

    Bring files from daniela branch

[33mcommit abab403aa6dafc1484a63e79c58c53b30ddc89a5[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 10 01:32:27 2026 -0500

    fix: MapArea file has been repared and is now working

[33mcommit a5b45df1a35374e8237fba4d64baa2c325831d66[m
Merge: 4637a2f 7abcb06
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 10 01:07:32 2026 -0500

    Merge pull request #8 from MSOR03/molartera
    
    Merge pull request #7 from MSOR03/main

[33mcommit 7abcb06377b8686c00f81d312f8aad90021fea76[m
Merge: 8415736 4637a2f
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 10 01:06:30 2026 -0500

    Merge pull request #7 from MSOR03/main
    
    fix: A bug fix was added for the cells

[33mcommit 4637a2fed338ed5dc759570f8ab379694e7cd10c[m
Merge: ac905b6 8415736
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 10 01:06:19 2026 -0500

    Merge branch 'molartera' into main

[33mcommit 8b13937613dadd15bb53360a513247c726f24119[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 10 00:21:13 2026 -0500

    Ajuste de logos y acceso a paginas web

[33mcommit 8415736b915c509b8362d39ad0452d34f62591ef[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 10 00:18:09 2026 -0500

    fix: Added the lastest version of 2D graphics

[33mcommit 5f543514a5ff5e014b380553bea141ca1e8a3dcc[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Mon Mar 9 23:50:48 2026 -0500

    The documents structure was changed

[33mcommit e33409a687c2f8eb81f53638bdafdff97b1530ed[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Mon Mar 9 23:36:57 2026 -0500

    fix: Solved drill-down and select problem

[33mcommit ac905b67adbcf79f73fe045cb32a090f5385b8e4[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Mon Mar 9 10:55:35 2026 -0500

    fixed: The leaflet problem was fixed temporaly. Missing: Map performance LCP, review the reload function

[33mcommit 8afc99efe285db5a49ffa12dbbb62fb58e55bacc[m
Merge: 009e0c5 5e7f856
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Mon Mar 9 02:34:13 2026 -0500

    Merge pull request #6 from MSOR03/daniela
    
    feat: Added institucional icons and study area.

[33mcommit 5e7f856301eaffb11c4653927675bec75b30f984[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Thu Mar 5 23:35:17 2026 -0500

    Adición de logos y area de estudio

[33mcommit 009e0c55de8258a3c0988340286711edf114cac7[m
Merge: 10cbfc1 b655b78
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Thu Mar 5 06:34:49 2026 -0500

    Merge pull request #5 from MSOR03/molartera
    
    fixed : The bcrypt version was changed on requirements

[33mcommit b655b78daa97ea55ce7d0ba73cb56fac0ecda4a3[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Thu Mar 5 06:31:53 2026 -0500

    fixed : The bcrypt version was changed on requirements

[33mcommit 10cbfc16c42d568860a4a8c51c380741bb8077e2[m
Merge: 5c355a6 7733329
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Thu Mar 5 05:51:48 2026 -0500

    Merge pull request #4 from MSOR03/molartera
    
    Molartera

[33mcommit 77333294b4976c73a92ce6460f9ff00202af9570[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Thu Mar 5 05:18:40 2026 -0500

    feat: Added dark/lite mode , alsothe database structure was improved

[33mcommit 8a5790458ccce9bf338572543bbf5c4e2bd2c803[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Thu Mar 5 03:52:22 2026 -0500

    feat: Enhance metadata handling and improve spatial data processing in backend

[33mcommit 5c355a6eb9df3aae5cab24faddcb21c5085de6b0[m
Merge: b926de6 9859ddd
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Wed Mar 4 02:44:04 2026 -0500

    Merge pull request #3 from MSOR03/molartera
    
    Molartera

[33mcommit 9859ddd9d6a9c43c70aad8142bba3ceb1eddca0c[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Wed Mar 4 02:39:26 2026 -0500

    feat: Implement 2D spatial visualization with dynamic resolution and color scaling for drought data

[33mcommit 3d11b9298c0b18286dbfedcdcca0d6a5bf5e3315[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Wed Mar 4 00:50:01 2026 -0500

    feat: Increase default limit for historical data queries to 70000 and update click action logic in grid levels.
    fixed: Timeseries fuction is working for each level of detail

[33mcommit dc8ded8bef3c7ee74e8b58c0dd8ac7a5d0f0bcef[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 3 23:58:03 2026 -0500

    feat(api): Implement API service for drought monitoring with error handling and various endpoints
    
    feat(downsampling): Add downsampling utilities for time series data using LTTB and min-max methods
    
    feat(gridLevels): Create grid level manager for hierarchical cell navigation with resolution handling
    
    feat(staticCells): Introduce static cell definitions for ERA5, IMERG, and CHIRPS datasets with parsing functions

[33mcommit b926de6d608572a70a917ec16dcc91ea00e48631[m
Merge: 51b2993 e586c1f
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 3 21:50:52 2026 -0500

    Merge pull request #2 from MSOR03/molartera
    
    Backend + Frontend Merge

[33mcommit e586c1f963b9d8ae1b57133900b09477a9fed681[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 3 21:47:35 2026 -0500

    feat: Added a backend with features such as advanced search in temporary files and management logic for managing files, also runs the frontend in that project

[33mcommit d02b824b83ed29e5ecaabbbb10a468eca0511839[m
Merge: 45a276e 51b2993
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 3 20:34:11 2026 -0500

    Merge branch 'main' into molartera - Integrar ajustes de gráficas de Daniela

[33mcommit 45a276ef0286bec52449ae0d489591e41c7c0b20[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Tue Mar 3 18:44:23 2026 -0500

    feat: Initial backend structure

[33mcommit 51b2993928d173660551a33c81f5e22a36075030[m
Merge: 8627d4b 6e2fee9
Author: Maicol Sebastian Olarte Ramirez <153383565+MSOR03@users.noreply.github.com>
Date:   Tue Mar 3 17:59:18 2026 -0500

    Merge pull request #1 from MSOR03/daniela
    
    Ajustes de gráfica para visulizacion de variables

[33mcommit 6e2fee98d6998f71739bf0bdb45b5badc0440445[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Mar 3 17:53:20 2026 -0500

    Ajustes de gráfica para visulizacion de variables

[33mcommit 24026f253969a109934b46dfb04c892c2e4cdc72[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Sat Feb 28 16:31:12 2026 -0500

    feat: Sistema completo DroughtMonitor - Backend FastAPI con monitoreo de sequías
    
    - Backend FastAPI con autenticación JWT
    - 5 servicios implementados (DroughtAnalysis, CloudStorage, Cache, Export, GeoProcessor)
    - Sistema de sequías: 4 variables hidrometeorológicas + 7 índices
    - Endpoints para análisis histórico (1D/2D) y predicción (1m/3m/6m)
    - Optimizaciones para 45M registros (Redis cache, clustering espacial)
    - Soporte multi-cloud (R2, S3, B2) para archivos parquet
    - Integración Leaflet para visualización geoespacial
    - Documentación consolidada (README.md + ARCHITECTURE.md)
    - Suite de pruebas completa (test.py)

[33mcommit 8627d4b7d832cafdf34c18a97f7f20475264b81d[m
Merge: de1a077 4d8c907
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Sat Feb 28 12:42:07 2026 -0500

    Merge branch 'main' of https://github.com/MSOR03/DroughtMonitor

[33mcommit de1a07728437a0365271c712616525c432e7ba61[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Sat Feb 28 11:53:30 2026 -0500

    Guardando cambios locales antes del pull

[33mcommit 4d8c907cd40095c6423350c7f3c3c977e89f873d[m
Author: MSOR03 <molartera@unal.edu.co>
Date:   Fri Feb 27 15:00:33 2026 -0500

    feat: Initial interface design was added , taking into account the given scheme

[33mcommit e5689a4705f2ad8d647bdb4164270610652acdf8[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Feb 24 19:20:43 2026 -0500

    The project was created with nine years

[33mcommit 01febb79957a73a503a6962c138bd80e13d0aeae[m
Author: jeortegat <jeortegat@unal.edu.co>
Date:   Tue Feb 24 18:56:51 2026 -0500

    first commit
