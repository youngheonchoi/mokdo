package com.mokdo.backend.character;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class CostumeImageSourceTests {
    @Test void loadsSupportedAssetPngsIncludingNpcsUsingThePublicBucketPath() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var requested=new AtomicReference<String>();
        byte[] png={(byte)137,80,78,71,13,10,26,10,0};
        server.createContext("/",exchange->{
            requested.set(exchange.getRequestURI().getPath());
            exchange.getResponseHeaders().set("Content-Type","image/png");
            exchange.sendResponseHeaders(200,png.length);
            exchange.getResponseBody().write(png);exchange.close();
        });
        server.start();
        try {
            var source=new CostumeImageSource("http://127.0.0.1:"+server.getAddress().getPort()+"/mokdo-dev-assets/");
            for (String prefix : new String[]{"monsters", "costumes", "items", "npcs"}) {
                String key = prefix + "/" + UUID.randomUUID() + "/" + UUID.randomUUID() + ".png";
                assertArrayEquals(png, source.fetch(key));
                assertEquals("/mokdo-dev-assets/" + key, requested.get());
            }
        } finally {server.stop(0);}
    }
}
