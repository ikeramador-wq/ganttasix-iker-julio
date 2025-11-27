// Simulación de respuesta de una API (sin necesidad de devolver nada)
const response = {
    status: "OK",
    totalRows: 4,
    result: {
        Menu: [
            {
                Centro: "01",
                Descripcion: "Sierra",
                Maquina: [
                    { Maquina: "MAQ001", Descripcion: "Sierra" },
                    { Maquina: "MAQ003", Descripcion: "Sierra3" }
                ]
            },
            {
                Centro: "02",
                Descripcion: "Tornos Cilíndricos",
                Maquina: [
                    { Maquina: "MAQ009", Descripcion: "Torno" },
                    { Maquina: "MAQ010", Descripcion: "Torno2" }
                ]
            },
            {
                Centro: "18",
                Descripcion: "Inyección",
                Maquina: [
                    { Maquina: "MAQ018", Descripcion: "Inyectora" },
                    { Maquina: "MAQ019", Descripcion: "Inyectora2" }
                ]
            }
        ],

        trabajos_O: [
            {
                Alarma: "0",
                Articulo: "IND.A",
                Bucket: "2025-11-04T14:14:00",
                Centro_Trabajo: "01",
                Codigo_Maquina: "MAQ001",
                Descripcion: "2025/11/04 14:16:49",
                DescripcionArticulo: "ARTICULO PRODUCTO ACABADO PRUEBAS",
                DescripcionCentroTrabajo: "Sierra",
                DescripcionMaquina: "Sierra",
                Descripcion_Fase: "Serrado",
                Fe_Ho_Final_Asig: "2025-11-26T08:06:48",
                Fe_Ho_Inicio_Asig: "2025-11-23T20:18:48",
                Num_Lanzamiento: 91,
                Tipo: "O",
                Trabajo: 144
            },
            {
                Alarma: "0",
                Articulo: "IND.A",
                Bucket: "2025-11-04T14:14:00",
                Centro_Trabajo: "02",
                Codigo_Maquina: "MAQ009",
                Descripcion: "2025/11/04 14:16:49",
                DescripcionArticulo: "ARTICULO PRODUCTO ACABADO PRUEBAS",
                DescripcionCentroTrabajo: "Tornos Cilíndricos",
                DescripcionMaquina: "Torno",
                Descripcion_Fase: "Cilindrado",
                Fe_Ho_Final_Asig: "2025-11-18T21:06:48",
                Fe_Ho_Inicio_Asig: "2025-11-18T20:18:48",
                Num_Lanzamiento: 91,
                Tipo: "O",
                Trabajo: 144
            },
            {
                Alarma: "0",
                Articulo: "IND.B",
                Centro_Trabajo: "18",
                Codigo_Maquina: "MAQ018",
                Descripcion: "YVS NEW IND.A",
                DescripcionArticulo: "ARTICULO SEMI ELABORADO PRUEBAS",
                DescripcionCentroTrabajo: "Inyección",
                DescripcionMaquina: "Inyectora",
                Descripcion_Fase: "MEZCLADO",
                Fe_Ho_Final_Asig: "2025-11-05T19:08:48",
                Fe_Ho_Inicio_Asig: "2025-11-05T17:08:48",
                Num_Lanzamiento: 109,
                Tipo: "O",
                Trabajo: 163
            },
            {
                Alarma: "0",
                Articulo: "IND.B",
                Centro_Trabajo: "01",
                Codigo_Maquina: "MAQ003",
                Descripcion: "PRUEBACAMPOFECHA",
                DescripcionArticulo: "ARTICULO SEMI ELABORADO PRUEBAS",
                DescripcionCentroTrabajo: "Inyección",
                DescripcionMaquina: "Inyectora",
                Descripcion_Fase: "MEZCLADO",
                Fe_Ho_Final_Asig: "2025-11-06T16:58:48",
                Fe_Ho_Inicio_Asig: "2025-11-05T18:00:00",
                Num_Lanzamiento: 110,
                Tipo: "O",
                Trabajo: 167
            }
        ]
    }
};
