package com.mokdo.backend.character;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CostumeImageSource {
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final byte[] PNG_SIGNATURE = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    public CostumeImageSource(@Value("${app.assets.storage-public-url:}") String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    public byte[] fetch(String key) {
        if (baseUrl.isBlank() || key == null || !key.matches("(?:costumes|items)/[a-f0-9-]{36}/[a-f0-9-]{36}\\.png")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        var request = HttpRequest.newBuilder(URI.create(baseUrl + "/" + key)).timeout(Duration.ofSeconds(15)).GET().build();
        try {
            var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var body = response.body()) {
                if (response.statusCode() == 404) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
                if (response.statusCode() != 200) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "코스튬 이미지를 불러오지 못했습니다.");
                byte[] bytes = body.readNBytes(MAX_BYTES + 1);
                if (bytes.length > MAX_BYTES || bytes.length < 8 || !Arrays.equals(Arrays.copyOf(bytes, 8), PNG_SIGNATURE)) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "코스튬 이미지 형식을 확인해주세요.");
                }
                return bytes;
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "코스튬 이미지를 불러오지 못했습니다.");
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "코스튬 이미지를 불러오지 못했습니다.");
        }
    }
}
